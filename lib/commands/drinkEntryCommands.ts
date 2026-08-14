import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { newlyEarnedAchievements } from "@/lib/achievements";
import { SESSION_GAP_MS, MAX_BACKDATE_MS } from "@/lib/sessions";
import { getUserTimeZone } from "@/lib/timezone";
import { drinkPhotoService } from "@/lib/photoUpload";
import { shareImageCache } from "@/lib/shareImageCache";
import { getFollowerIds } from "@/lib/queries/followQueries";
import { queueNotifications, type NotificationEvent } from "@/lib/notify";
import { resolveVenueId } from "@/lib/commands/venueCommands";
import {
  ActionResultDTO,
  AddDrinkResultDTO,
  CreateDrinkEntryDTO,
  DeleteDrinkEntryDTO,
  UpdateDrinkEntryDTO,
} from "@/lib/dtos";

type Tx = Prisma.TransactionClient;

/**
 * createDrinkEntry is a "use server" action — createdAt is attacker-supplied
 * input from any authenticated caller, not just the offline-sync flow that
 * legitimately needs it. Future/too-old values fall back to now() rather
 * than being trusted, since achievements/streaks would otherwise be
 * gameable by backdating freely.
 */
function resolveCreatedAt(clientCreatedAt: number | null | undefined): Date {
  const now = Date.now();
  if (clientCreatedAt == null) return new Date(now);
  const withinTrustWindow = clientCreatedAt <= now && clientCreatedAt >= now - MAX_BACKDATE_MS;
  return new Date(withinTrustWindow ? clientCreatedAt : now);
}

/**
 * Places a new check-in into whichever session it belongs to — attaching to
 * the session before or after it, merging two sessions it bridges, or
 * starting a new one — and returns that session's id. Doesn't create the
 * DrinkEntry itself: the caller does that with `entryId` once any
 * DrinkSession bookkeeping here has settled.
 *
 * Insertion (unlike deletion) never needs to re-derive a session's bounds
 * from scratch: since createdAt is clamped, and `prev`/`next` are always the
 * entries immediately bordering it, each case below has a closed-form bounds
 * update (or none) rather than needing a full re-aggregate.
 */
/** Clears a share-image cache pair in an update's `data`, in place. */
const CLEAR_SHARE_IMAGE_CACHE = {
  shareImageOpaqueUrl: null,
  shareImageTransparentUrl: null,
} as const;

async function assignSessionForNewEntry(
  tx: Tx,
  userId: string,
  entryId: string,
  createdAt: Date
): Promise<{ sessionId: string; isNewSession: boolean; orphanedShareImageUrls: string[] }> {
  const time = createdAt.getTime();

  const [prev, next] = await Promise.all([
    tx.drinkEntry.findFirst({
      where: { userId, createdAt: { lte: createdAt } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, sessionId: true },
    }),
    tx.drinkEntry.findFirst({
      where: { userId, createdAt: { gt: createdAt } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, sessionId: true },
    }),
  ]);

  const prevInGap = prev !== null && time - prev.createdAt.getTime() <= SESSION_GAP_MS;
  const nextInGap = next !== null && next.createdAt.getTime() - time <= SESSION_GAP_MS;

  if (prev && next && prevInGap && nextInGap && prev.sessionId !== next.sessionId) {
    // Bridges two sessions — the earlier one survives and absorbs the later.
    const survivorId = prev.sessionId;
    const loserId = next.sessionId;

    // Everything in this first wave is mutually independent — none reads a
    // value another produces, so they run concurrently on the same tx
    // connection (the same pattern already used above for prev/next) instead
    // of one sequential round trip apiece. The Cheer read covers both
    // sessions at once (partitioned in JS below) rather than two separate
    // finds. Reassigning Comment/Notification here, ahead of the delete
    // below, matters: Comment is FK'd to DrinkSession with onDelete: Cascade,
    // so without reassigning it first it would be silently deleted along
    // with the loser row, even though the check-ins it's about are still
    // very much alive (now under the survivor's id). Notification isn't an
    // FK (frozen-at-write-time by design) so it can't violate a constraint
    // either way, but leaving it pointed at a session that's about to stop
    // existing would 404 an otherwise-valid link.
    const [loser, cheerRows] = await Promise.all([
      tx.drinkSession.findUniqueOrThrow({ where: { id: loserId } }),
      tx.cheer.findMany({
        where: { sessionId: { in: [loserId, survivorId] } },
        select: { sessionId: true, userId: true },
      }),
      tx.drinkEntry.updateMany({ where: { sessionId: loserId }, data: { sessionId: survivorId } }),
      tx.comment.updateMany({ where: { sessionId: loserId }, data: { sessionId: survivorId } }),
      tx.notification.updateMany({ where: { entryId: loserId }, data: { entryId: survivorId } }),
    ]);

    const loserCheerUserIds = cheerRows.filter((c) => c.sessionId === loserId).map((c) => c.userId);
    const survivorCheerUserIds = new Set(
      cheerRows.filter((c) => c.sessionId === survivorId).map((c) => c.userId)
    );
    // If the same user cheered both sessions, reassigning would collide on
    // the (sessionId, userId) primary key — drop the loser's copy rather
    // than double-count what's really the same cheer.
    const colliding = loserCheerUserIds.filter((id) => survivorCheerUserIds.has(id));
    const clear = loserCheerUserIds.filter((id) => !survivorCheerUserIds.has(id));

    // Second wave: the two Cheer cleanup calls target disjoint user-id sets
    // (colliding vs. clear) so they can't conflict with each other, and the
    // survivor's endedAt bump touches a different table entirely — all three
    // run concurrently rather than one after another.
    await Promise.all([
      colliding.length > 0
        ? tx.cheer.deleteMany({ where: { sessionId: loserId, userId: { in: colliding } } })
        : null,
      clear.length > 0
        ? tx.cheer.updateMany({ where: { sessionId: loserId, userId: { in: clear } }, data: { sessionId: survivorId } })
        : null,
      tx.drinkSession.update({
        where: { id: survivorId },
        data: { endedAt: loser.endedAt, ...CLEAR_SHARE_IMAGE_CACHE },
      }),
    ]);

    // Must be last: everything above that could still reference loserId
    // (Cheer/Comment/Notification reassignment) has already landed, so the
    // cascade this delete triggers has nothing left to sweep up.
    await tx.drinkSession.delete({ where: { id: loserId } });
    // The loser row is gone for good — its own cached render (if any) is
    // never regenerated in place, unlike ordinary invalidation, so it's
    // worth actually deleting rather than leaving it orphaned in storage.
    const orphanedShareImageUrls = [loser.shareImageOpaqueUrl, loser.shareImageTransparentUrl].filter(
      (url): url is string => !!url
    );
    return { sessionId: survivorId, isNewSession: false, orphanedShareImageUrls };
  }

  if (prev && prevInGap) {
    // Either only prev is in range (prev's session's last entry, extend
    // endedAt), or both are and they're the same session (inserting into
    // its middle — bounds already cover this entry, nothing to update).
    // Either way this session gained an entry, so its cached share image
    // (if any) is stale regardless of which sub-case this is.
    const sessionId = prev.sessionId;
    await tx.drinkSession.update({
      where: { id: sessionId },
      data: { ...(!nextInGap ? { endedAt: createdAt } : {}), ...CLEAR_SHARE_IMAGE_CACHE },
    });
    return { sessionId, isNewSession: false, orphanedShareImageUrls: [] };
  }

  if (next && nextInGap) {
    // next's session's first entry — extend startedAt. The session's id
    // stays put even though this entry is now chronologically first: id
    // stability for existing links matters more than "id = literally the
    // first entry" being true 100% of the time.
    const sessionId = next.sessionId;
    await tx.drinkSession.update({
      where: { id: sessionId },
      data: { startedAt: createdAt, ...CLEAR_SHARE_IMAGE_CACHE },
    });
    return { sessionId, isNewSession: false, orphanedShareImageUrls: [] };
  }

  await tx.drinkSession.create({ data: { id: entryId, userId, startedAt: createdAt, endedAt: createdAt } });
  return { sessionId: entryId, isNewSession: true, orphanedShareImageUrls: [] };
}

export async function createDrinkEntry(
  userId: string,
  input: CreateDrinkEntryDTO,
  actor: { username: string; avatarUrl: string | null }
): Promise<AddDrinkResultDTO> {
  const tz = await getUserTimeZone();

  const createdAt = resolveCreatedAt(input.createdAt);
  const entryId = randomUUID();

  let created;
  let isNewSession: boolean;
  let before;
  try {
    const result = await db.$transaction(async (tx) => {
      // Session assignment is read-then-write (find neighbours, then attach/
      // merge/create) with no row locking of its own — two concurrent
      // creates for the same user (double-submit, two tabs/devices) could
      // each see the same "no session yet" state and each create their own,
      // instead of one correctly attaching to the other. A transaction-scoped
      // advisory lock keyed by userId serializes session mutations per user
      // (auto-released at commit/rollback) without blocking other users.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

      // Read history once *after* the lock, not before the transaction
      // opens — the "after" set is provably "before + the new row", so
      // there's no need for a second full-table scan, but reading it before
      // the lock let two concurrent check-ins for the same user (an offline
      // sync burst flushing several at once) both see the same pre-write
      // achievement snapshot, both independently compute
      // newlyEarnedAchievements as "just crossed the threshold", and both
      // fire the same "Achievement Unlocked" notification for something
      // that should only ever fire once. Can't use getDrinkHistory's 60s
      // cache here regardless (it needs fresh pre-write state) — select
      // only what computeAchievements/countSessions actually read
      // (lib/achievements.ts), not every column.
      const before = await tx.drinkEntry.findMany({
        where: { userId },
        select: {
          userId: true,
          createdAt: true,
          drinkType: true,
          venue: { select: { name: true } },
        },
      });

      const assignment = await assignSessionForNewEntry(tx, userId, entryId, createdAt);
      const venueId = await resolveVenueId(tx, input.venue, input.lat, input.lng);
      const entry = await tx.drinkEntry.create({
        data: {
          id: entryId,
          userId,
          sessionId: assignment.sessionId,
          drinkName: input.drinkName,
          drinkType: input.drinkType,
          venueId,
          photoUrl: input.photoUrl,
          photoLqip: input.photoLqip,
          createdAt,
        },
      });
      return {
        entry,
        before,
        isNewSession: assignment.isNewSession,
        orphanedShareImageUrls: assignment.orphanedShareImageUrls,
      };
    });
    created = result.entry;
    before = result.before;
    isNewSession = result.isNewSession;
    if (result.orphanedShareImageUrls.length > 0) {
      await Promise.all(result.orphanedShareImageUrls.map((url) => shareImageCache.remove(url)));
    }
  } catch {
    return { error: "Failed to save check-in." };
  }

  const beforeEntries = before.map((e) => ({
    user_id: e.userId,
    created_at: e.createdAt.toISOString(),
    drink_type: e.drinkType,
    venue: e.venue?.name ?? null,
  }));
  // Built from `input.venue` (the name string, not `created`) since `created`
  // comes back from `tx.drinkEntry.create` with no venue include — Prisma
  // silently returns `undefined` for a relation that isn't included, which
  // would otherwise make a check-in's own new venue invisible to the
  // achievement diff that's supposed to just-unlock on it.
  const afterEntry = {
    user_id: created.userId,
    created_at: created.createdAt.toISOString(),
    drink_type: created.drinkType,
    venue: input.venue,
  };
  const newlyEarned = newlyEarnedAchievements(beforeEntries, afterEntry, tz);
  const achievementUnlocked = newlyEarned.length > 0;

  const events: NotificationEvent[] = newlyEarned.map((a) => ({
    userId,
    type: "ACHIEVEMENT",
    achievementLabel: a.label,
  }));

  if (isNewSession) {
    const followerIds = await getFollowerIds(userId);
    events.push(
      ...followerIds.map((followerId) => ({
        userId: followerId,
        type: "SESSION_START" as const,
        actorId: userId,
        actorUsername: actor.username,
        actorAvatarUrl: actor.avatarUrl,
        // The session's id, not the entry's own id — they only coincide
        // when this check-in started a brand-new session (always true
        // here), but Notification.entryId is what /sessions/[id] links use.
        entryId: created.sessionId,
      }))
    );
  }

  const memberships = isNewSession
    ? await db.groupMember.findMany({
        where: { userId },
        select: { groupId: true, group: { select: { name: true } } },
      })
    : [];
  if (memberships.length > 0) {
    const groupIds = memberships.map((m) => m.groupId);
    const otherMembers = await db.groupMember.findMany({
      where: { groupId: { in: groupIds }, userId: { not: userId } },
      select: { userId: true, groupId: true },
    });
    const groupNames = new Map(memberships.map((m) => [m.groupId, m.group.name]));
    events.push(
      ...otherMembers.map((m) => ({
        userId: m.userId,
        type: "CREW_CHECKIN" as const,
        actorId: userId,
        actorUsername: actor.username,
        actorAvatarUrl: actor.avatarUrl,
        // The session's id — this check-in may have attached to an
        // existing session rather than started a new one, in which case
        // created.id itself isn't a valid /sessions/[id] target.
        entryId: created.sessionId,
        groupId: m.groupId,
        groupName: groupNames.get(m.groupId),
      }))
    );
  }

  queueNotifications(events);

  return { achievementUnlocked, id: created.id, revalidatedPaths: [`/sessions/${created.sessionId}`] };
}

export async function updateDrinkEntry(
  userId: string,
  input: UpdateDrinkEntryDTO
): Promise<ActionResultDTO> {
  let existing: { photoUrl: string | null; sessionId: string } | null = null;

  try {
    const result = await db.$transaction(async (tx) => {
      // A concurrent createDrinkEntry can merge this entry's session into
      // another one (and delete the old session row) between a read taken
      // before this transaction opens and this transaction's own writes —
      // the same per-user advisory lock createDrinkEntry/deleteDrinkEntry
      // already use serializes that against this edit, but only if the
      // sessionId is read *after* acquiring it, inside this transaction.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

      const current = await tx.drinkEntry.findFirst({
        where: { id: input.id, userId },
        select: { photoUrl: true, sessionId: true },
      });
      if (!current) return null;

      const venueId = await resolveVenueId(tx, input.venue, input.lat, input.lng);
      await tx.drinkEntry.updateMany({
        where: { id: input.id, userId },
        data: {
          drinkName: input.drinkName,
          drinkType: input.drinkType,
          venueId,
          photoUrl: input.photoUrl,
          photoLqip: input.photoLqip,
        },
      });
      // Any of the edited fields can change what the share card would show
      // (title, venue line, route, hero photo fallback) — invalidate rather
      // than track exactly which ones did.
      await tx.drinkSession.update({
        where: { id: current.sessionId },
        data: CLEAR_SHARE_IMAGE_CACHE,
      });
      return current;
    });
    if (!result) return { error: "Check-in not found" };
    existing = result;
  } catch {
    return { error: "Failed to update check-in." };
  }

  if (existing.photoUrl && existing.photoUrl !== input.photoUrl) {
    await drinkPhotoService.remove(existing.photoUrl, userId);
  }

  return { revalidatedPaths: [`/sessions/${existing.sessionId}`] };
}

/**
 * Re-derives a session's membership after one of its check-ins is deleted.
 * Removing a middle entry can expose a >4h gap between its former
 * neighbours, splitting one session into two — so (unlike insertion) this
 * needs to re-cluster from scratch rather than a closed-form bounds update.
 * The earliest resulting cluster keeps the original session id (so existing
 * comments/cheers/links stay attached to whichever entries are still
 * chronologically anchored there); later clusters mint fresh ids.
 */
async function reclusterSessionAfterDelete(
  tx: Tx,
  userId: string,
  sessionId: string
): Promise<string[]> {
  const remaining = await tx.drinkEntry.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    select: { id: true, createdAt: true },
  });

  if (remaining.length === 0) {
    const deleted = await tx.drinkSession.delete({ where: { id: sessionId } });
    // This row is gone for good — its cached render (if any) never gets
    // regenerated in place, so it's worth deleting rather than orphaning.
    return [deleted.shareImageOpaqueUrl, deleted.shareImageTransparentUrl].filter(
      (url): url is string => !!url
    );
  }

  const clusters: (typeof remaining)[] = [];
  let current: typeof remaining = [];
  for (const entry of remaining) {
    const prev = current[current.length - 1];
    if (prev && entry.createdAt.getTime() - prev.createdAt.getTime() > SESSION_GAP_MS) {
      clusters.push(current);
      current = [];
    }
    current.push(entry);
  }
  clusters.push(current);

  const [first, ...rest] = clusters;
  await tx.drinkSession.update({
    where: { id: sessionId },
    data: {
      startedAt: first[0].createdAt,
      endedAt: first[first.length - 1].createdAt,
      ...CLEAR_SHARE_IMAGE_CACHE,
    },
  });

  for (const cluster of rest) {
    const newSessionId = cluster[0].id;
    // A freshly created row — no cache to invalidate.
    await tx.drinkSession.create({
      data: {
        id: newSessionId,
        userId,
        startedAt: cluster[0].createdAt,
        endedAt: cluster[cluster.length - 1].createdAt,
      },
    });
    await tx.drinkEntry.updateMany({
      where: { id: { in: cluster.map((e) => e.id) } },
      data: { sessionId: newSessionId },
    });
  }

  return [];
}

export async function deleteDrinkEntry(
  userId: string,
  input: DeleteDrinkEntryDTO
): Promise<ActionResultDTO> {
  let entry: { photoUrl: string | null; sessionId: string } | null = null;
  let orphanedShareImageUrls: string[] = [];
  try {
    const result = await db.$transaction(async (tx) => {
      // Same per-user serialization as createDrinkEntry's lock, and the same
      // key, so a concurrent create/delete pair for one user also serializes
      // against each other, not just delete-vs-delete. The entry (and its
      // sessionId) must be read *after* acquiring this lock, inside this
      // transaction — reading it beforehand let a concurrent createDrinkEntry
      // merge/delete this entry's session out from under a stale sessionId,
      // making reclusterSessionAfterDelete's own delete/update below throw on
      // an already-gone row and roll back the delete the user actually asked
      // for.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

      const current = await tx.drinkEntry.findFirst({
        where: { id: input.id, userId },
        select: { photoUrl: true, sessionId: true },
      });
      if (!current) return null;

      await tx.drinkEntry.deleteMany({ where: { id: input.id, userId } });
      const urls = await reclusterSessionAfterDelete(tx, userId, current.sessionId);
      return { entry: current, orphanedShareImageUrls: urls };
    });
    if (!result) return {};
    entry = result.entry;
    orphanedShareImageUrls = result.orphanedShareImageUrls;
  } catch {
    return { error: "Failed to delete check-in." };
  }

  if (entry.photoUrl) {
    await drinkPhotoService.remove(entry.photoUrl, userId);
  }
  if (orphanedShareImageUrls.length > 0) {
    await Promise.all(orphanedShareImageUrls.map((url) => shareImageCache.remove(url)));
  }

  return { revalidatedPaths: [`/sessions/${entry.sessionId}`] };
}
