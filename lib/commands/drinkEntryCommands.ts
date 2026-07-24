import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { computeAchievements } from "@/lib/achievements";
import { SESSION_GAP_MS, MAX_BACKDATE_MS } from "@/lib/sessions";
import { getUserTimeZone } from "@/lib/timezone";
import { toDrinkEntry } from "@/lib/mappers";
import { drinkPhotoService } from "@/lib/photoUpload";
import { shareImageCache } from "@/lib/shareImageCache";
import { getFollowerIds } from "@/lib/queries/followQueries";
import { queueNotifications, type NotificationEvent } from "@/lib/notify";
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
    const loser = await tx.drinkSession.findUniqueOrThrow({ where: { id: loserId } });
    await tx.drinkEntry.updateMany({ where: { sessionId: loserId }, data: { sessionId: survivorId } });

    // The loser's Cheer/Comment/Notification links aren't gone just because
    // its DrinkSession row is about to be deleted below — Cheer/Comment are
    // FK'd to DrinkSession with onDelete: Cascade, so without reassigning
    // them first they'd be silently deleted along with it, even though the
    // check-ins they're about are still very much alive (now under the
    // survivor's id).
    await tx.comment.updateMany({ where: { sessionId: loserId }, data: { sessionId: survivorId } });

    const loserCheerUserIds = (
      await tx.cheer.findMany({ where: { sessionId: loserId }, select: { userId: true } })
    ).map((c) => c.userId);
    if (loserCheerUserIds.length > 0) {
      const survivorCheerUserIds = new Set(
        (
          await tx.cheer.findMany({ where: { sessionId: survivorId }, select: { userId: true } })
        ).map((c) => c.userId)
      );
      // If the same user cheered both sessions, reassigning would collide on
      // the (sessionId, userId) primary key — drop the loser's copy rather
      // than double-count what's really the same cheer.
      const colliding = loserCheerUserIds.filter((id) => survivorCheerUserIds.has(id));
      const clear = loserCheerUserIds.filter((id) => !survivorCheerUserIds.has(id));
      if (colliding.length > 0) {
        await tx.cheer.deleteMany({ where: { sessionId: loserId, userId: { in: colliding } } });
      }
      if (clear.length > 0) {
        await tx.cheer.updateMany({
          where: { sessionId: loserId, userId: { in: clear } },
          data: { sessionId: survivorId },
        });
      }
    }

    // Not an FK (frozen-at-write-time by design), so this can't violate a
    // constraint either way — but leaving it pointed at a session that's
    // about to stop existing would 404 an otherwise-valid notification link.
    await tx.notification.updateMany({ where: { entryId: loserId }, data: { entryId: survivorId } });

    await tx.drinkSession.update({
      where: { id: survivorId },
      data: { endedAt: loser.endedAt, ...CLEAR_SHARE_IMAGE_CACHE },
    });
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
  // Read history once; the "after" set is provably "before + the new row",
  // so there's no need for a second full-table scan.
  const before = await db.drinkEntry.findMany({ where: { userId } });

  const createdAt = resolveCreatedAt(input.createdAt);
  const entryId = randomUUID();

  let created;
  let isNewSession: boolean;
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
      const assignment = await assignSessionForNewEntry(tx, userId, entryId, createdAt);
      const entry = await tx.drinkEntry.create({
        data: {
          id: entryId,
          userId,
          sessionId: assignment.sessionId,
          drinkName: input.drinkName,
          drinkType: input.drinkType,
          venue: input.venue,
          lat: input.lat,
          lng: input.lng,
          notes: input.notes,
          photoUrl: input.photoUrl,
          photoLqip: input.photoLqip,
          createdAt,
        },
      });
      return {
        entry,
        isNewSession: assignment.isNewSession,
        orphanedShareImageUrls: assignment.orphanedShareImageUrls,
      };
    });
    created = result.entry;
    isNewSession = result.isNewSession;
    if (result.orphanedShareImageUrls.length > 0) {
      await Promise.all(result.orphanedShareImageUrls.map((url) => shareImageCache.remove(url)));
    }
  } catch {
    return { error: "Failed to save check-in." };
  }

  const beforeEntries = before.map(toDrinkEntry);
  const earnedBefore = new Set(
    computeAchievements(beforeEntries, tz)
      .filter((a) => a.earned)
      .map((a) => a.id)
  );
  const newlyEarned = computeAchievements([...beforeEntries, toDrinkEntry(created)], tz).filter(
    (a) => a.earned && !earnedBefore.has(a.id)
  );
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

    const memberships = await db.groupMember.findMany({
      where: { userId },
      select: { groupId: true, group: { select: { name: true } } },
    });
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
          type: "CREW_SESSION_START" as const,
          actorId: userId,
          actorUsername: actor.username,
          actorAvatarUrl: actor.avatarUrl,
          // The session's id, not the entry's own id — they only coincide
          // when this check-in started a brand-new session (always true
          // here), but Notification.entryId is what /sessions/[id] links use.
          entryId: created.sessionId,
          groupId: m.groupId,
          groupName: groupNames.get(m.groupId),
        }))
      );
    }
  }

  queueNotifications(events);

  return { achievementUnlocked, id: created.id };
}

export async function updateDrinkEntry(
  userId: string,
  input: UpdateDrinkEntryDTO
): Promise<ActionResultDTO> {
  const existing = await db.drinkEntry.findFirst({
    where: { id: input.id, userId },
    select: { photoUrl: true, sessionId: true },
  });
  if (!existing) return { error: "Check-in not found" };

  try {
    await db.$transaction(async (tx) => {
      await tx.drinkEntry.updateMany({
        where: { id: input.id, userId },
        data: {
          drinkName: input.drinkName,
          drinkType: input.drinkType,
          venue: input.venue,
          lat: input.lat,
          lng: input.lng,
          notes: input.notes,
          photoUrl: input.photoUrl,
          photoLqip: input.photoLqip,
        },
      });
      // Any of the edited fields can change what the share card would show
      // (title, venue line, route, hero photo fallback) — invalidate rather
      // than track exactly which ones did.
      await tx.drinkSession.update({
        where: { id: existing.sessionId },
        data: CLEAR_SHARE_IMAGE_CACHE,
      });
    });
  } catch {
    return { error: "Failed to update check-in." };
  }

  if (existing.photoUrl && existing.photoUrl !== input.photoUrl) {
    await drinkPhotoService.remove(existing.photoUrl, userId);
  }

  return {};
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
  const entry = await db.drinkEntry.findFirst({
    where: { id: input.id, userId },
    select: { photoUrl: true, sessionId: true },
  });
  if (!entry) return {};

  let orphanedShareImageUrls: string[] = [];
  try {
    await db.$transaction(async (tx) => {
      // Same per-user serialization as createDrinkEntry's lock, and the same
      // key, so a concurrent create/delete pair for one user also serializes
      // against each other, not just delete-vs-delete.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      await tx.drinkEntry.deleteMany({ where: { id: input.id, userId } });
      orphanedShareImageUrls = await reclusterSessionAfterDelete(tx, userId, entry.sessionId);
    });
  } catch {
    return { error: "Failed to delete check-in." };
  }

  if (entry.photoUrl) {
    await drinkPhotoService.remove(entry.photoUrl, userId);
  }
  if (orphanedShareImageUrls.length > 0) {
    await Promise.all(orphanedShareImageUrls.map((url) => shareImageCache.remove(url)));
  }

  return {};
}
