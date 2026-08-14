import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { avatarPhotoService } from "@/lib/avatarPhoto";
import { drinkPhotoService } from "@/lib/photoUpload";
import { deleteGroup } from "@/lib/commands/groupCommands";
import {
  AccountPurgeResultDTO,
  ActionResultDTO,
  AvatarUploadResultDTO,
  CreateUserDTO,
  UpdateProfileDTO,
} from "@/lib/dtos";

export async function createUser(input: CreateUserDTO): Promise<ActionResultDTO> {
  const username = input.username.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (username.length < 2 || username.length > 30) {
    return { error: "Username must be between 2 and 30 characters." };
  }

  if (!email) {
    return { error: "Email is required." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  try {
    const passwordHash = await hashPassword(password);
    await db.user.create({
      data: {
        email,
        username,
        passwordHash,
      },
    });
  } catch (createError) {
    const code =
      createError instanceof Prisma.PrismaClientKnownRequestError
        ? createError.code
        : null;

    if (code === "P2002") {
      const target =
        createError instanceof Prisma.PrismaClientKnownRequestError
          ? (createError.meta?.target as string[] | undefined)?.join(",") ?? ""
          : "";

      if (target.includes("username")) {
        return { error: "That username is already taken." };
      }

      if (target.includes("email")) {
        return { error: "An account with this email already exists." };
      }
    }

    return { error: "Failed to create account. Please try again." };
  }

  return {};
}

/** Marks the first-run onboarding flow (app/onboarding) done, whether the user finished it or skipped it — either way there's nothing left to show. */
export async function completeOnboarding(userId: string): Promise<ActionResultDTO> {
  await db.user.update({
    where: { id: userId },
    data: { hasCompletedOnboarding: true },
  });
  return {};
}

export async function updateProfileUsername(
  userId: string,
  input: UpdateProfileDTO
): Promise<ActionResultDTO> {
  const username = input.username.trim();

  try {
    await db.user.update({
      where: { id: userId },
      data: { username },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "unique constraint" };
    }
    return { error: "Failed to update username." };
  }

  return {};
}

export async function updateProfileAvatar(
  userId: string,
  avatarUrl: string
): Promise<ActionResultDTO> {
  const existing = await db.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });

  try {
    await db.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });
  } catch {
    return { error: "Failed to update profile picture." };
  }

  // Mirrors updateDrinkEntry (lib/commands/drinkEntryCommands.ts) — only
  // clean up the old blob once the new one is durably saved, never before.
  if (existing?.avatarUrl && existing.avatarUrl !== avatarUrl) {
    await avatarPhotoService.remove(existing.avatarUrl, userId);
  }

  return {};
}

/**
 * The saga shared by both avatar upload routes (`app/api/uploads/avatar/route.ts`
 * for the plain path, `finalize/route.ts` for the direct-upload path): the
 * blob is already durably stored by the time this runs, so a failed DB link
 * is rolled back by deleting it — otherwise it's an orphan with nothing left
 * to reference it (see `lib/commands/photoCleanupCommands.ts`, the backstop
 * for whatever still slips through).
 */
async function linkAvatarOrRollback(userId: string, url: string): Promise<AvatarUploadResultDTO> {
  const result = await updateProfileAvatar(userId, url);
  if (result.error) {
    await avatarPhotoService.remove(url, userId);
    return { error: result.error };
  }
  return { url };
}

/** Plain single-request upload path (local dev disk storage — see lib/storageAdapterFactory.ts). */
export async function storeAvatar(userId: string, file: File): Promise<AvatarUploadResultDTO> {
  const { url } = await avatarPhotoService.processAndStore(file, userId);
  return linkAvatarOrRollback(userId, url);
}

/** Direct-to-Blob upload path's follow-up step (production/staging — see lib/storageAdapterFactory.ts). */
export async function finalizeAvatarUpload(userId: string, rawUrl: string): Promise<AvatarUploadResultDTO> {
  const { url } = await avatarPhotoService.finalizeDirectUpload(rawUrl, userId);
  return linkAvatarOrRollback(userId, url);
}

/**
 * Transfers ownership of any crew `userId` owns to its longest-tenured
 * *not-also-pending-deletion* other member — or deletes the crew outright
 * if no such member exists — so a raw cascade delete of the User row (which
 * Group.ownerId also cascades on) never collaterally destroys other
 * members' data. The `deletionRequestedAt: null` filter on the successor
 * matters: without it, ownership could land on a member who is themselves
 * mid-grace-period, and since purgeExpiredDeletedAccounts doesn't re-derive
 * "what does this account own" from scratch, that crew would silently
 * cascade-delete when *that* member's own purge runs later — a real
 * incident this app shipped once and is fixing here. Called both from
 * requestAccountDeletion (the normal path) and defensively from
 * purgeExpiredDeletedAccounts (in case ownership was somehow reacquired
 * between request and purge).
 */
async function releaseOwnedCrews(userId: string): Promise<void> {
  const ownedGroups = await db.group.findMany({
    where: { ownerId: userId },
    select: { id: true },
  });

  for (const group of ownedGroups) {
    const successor = await db.groupMember.findFirst({
      where: { groupId: group.id, userId: { not: userId }, user: { deletionRequestedAt: null } },
      orderBy: { joinedAt: "asc" },
    });

    if (!successor) {
      await deleteGroup(userId, { groupId: group.id });
      continue;
    }

    await db.group.update({ where: { id: group.id }, data: { ownerId: successor.userId } });
    await db.groupMember.update({
      where: { groupId_userId: { groupId: group.id, userId: successor.userId } },
      data: { role: "OWNER" },
    });
    await db.groupMember.update({
      where: { groupId_userId: { groupId: group.id, userId } },
      data: { role: "MEMBER" },
    });
  }
}

/**
 * Starts the 7-day GDPR-erasure grace period (see prisma/schema.prisma's
 * User.deletionRequestedAt doc comment). Releases any crew this user owns
 * (releaseOwnedCrews above), then logs the account out everywhere. The
 * session wipe and the deletionRequestedAt write are wrapped in one
 * transaction (matching the array-form db.$transaction already used in
 * lib/commands/groupCommands.ts) specifically to close the gap a login on
 * another device could otherwise race through between the two — without it,
 * a session created between "delete all sessions" and "flag the account"
 * would survive untouched even though the account is now hidden and
 * counting down to purge.
 */
export async function requestAccountDeletion(userId: string): Promise<ActionResultDTO> {
  await releaseOwnedCrews(userId);

  await db.$transaction([
    db.session.deleteMany({ where: { userId } }),
    db.user.update({ where: { id: userId }, data: { deletionRequestedAt: new Date() } }),
  ]);

  return {};
}

/**
 * Reverses requestAccountDeletion — called on every login
 * (app/api/auth/login/route.ts), so the conditional check and the write
 * happen as one atomic query instead of the route reading User state
 * itself first. Returns whether a pending deletion actually existed to
 * cancel, so the caller knows whether to tell the user about it.
 */
export async function cancelAccountDeletion(userId: string): Promise<boolean> {
  const { count } = await db.user.updateMany({
    where: { id: userId, deletionRequestedAt: { not: null } },
    data: { deletionRequestedAt: null },
  });
  return count > 0;
}

// Matches scripts/backfill-photo-derivatives.ts's / photoCleanupCommands.ts's
// bounded-batch-per-run pattern — a purge involves real network calls to
// delete blobs, with no cooperative-cancellation signal if the cron's
// maxDuration is hit mid-run. Whatever's left over is still past its grace
// period on the next scheduled run, so nothing here depends on draining the
// whole backlog in one pass.
const MAX_ACCOUNTS_PURGED_PER_RUN = 25;
const DELETION_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The actual GDPR hard-delete, run on a schedule
 * (app/api/cron/purge-deleted-accounts/route.ts) for every account whose
 * requestAccountDeletion grace period has passed. DrinkEntry.photoLqip
 * is a base64 string stored inline in the row (not a blob), so only
 * DrinkEntry.photoUrl and User.avatarUrl need explicit blob deletion —
 * everything else cascades automatically once the User row goes (see
 * prisma/schema.prisma: Session, Follow, GroupMember, GroupBan,
 * GroupInvite, Cheer, Comment, PushSubscription, NotificationPreference,
 * ClientErrorLog, DrinkEntry, DrinkSession, and any crew still owned by
 * this user are all onDelete: Cascade). Crew ownership was already
 * resolved at request time (requestAccountDeletion above); releaseOwnedCrews
 * is called again here anyway as a defensive backstop, in case a crew was
 * somehow (re)acquired between request and purge.
 *
 * Notification is the one exception to "everything cascades": actorId is a
 * denormalized snapshot with no real FK (see its schema doc comment), so a
 * purged user's username/avatar would otherwise keep showing up forever in
 * *other* users' notification history ("X cheered your session") — real
 * erased-user PII surviving the erasure. Scrubbed explicitly below before
 * the user row goes, since nothing else will ever touch those rows again.
 */
export async function purgeExpiredDeletedAccounts(): Promise<AccountPurgeResultDTO> {
  const cutoff = new Date(Date.now() - DELETION_GRACE_PERIOD_MS);
  const dueAccounts = await db.user.findMany({
    where: { deletionRequestedAt: { lte: cutoff } },
    select: { id: true },
    take: MAX_ACCOUNTS_PURGED_PER_RUN,
  });

  let processed = 0;
  let failed = 0;

  for (const account of dueAccounts) {
    try {
      await releaseOwnedCrews(account.id);

      const [entries, user] = await Promise.all([
        db.drinkEntry.findMany({
          where: { userId: account.id, photoUrl: { not: null } },
          select: { photoUrl: true },
        }),
        db.user.findUnique({ where: { id: account.id }, select: { avatarUrl: true } }),
      ]);

      await Promise.all(
        entries
          .map((e) => e.photoUrl)
          .filter((url): url is string => url !== null)
          .map((url) => drinkPhotoService.remove(url, account.id))
      );
      if (user?.avatarUrl) {
        await avatarPhotoService.remove(user.avatarUrl, account.id);
      }

      await db.notification.updateMany({
        where: { actorId: account.id },
        data: { actorUsername: null, actorAvatarUrl: null },
      });

      // A conditional deleteMany, not delete(where:{id}) — re-checks
      // deletionRequestedAt is still set and still past cutoff as part of
      // the same atomic statement, so a login that ran cancelAccountDeletion
      // for this exact account in the gap between the findMany above and
      // this delete can't be silently overridden: count === 0 means the
      // user cancelled in the meantime, and this account is correctly left
      // alone rather than purged anyway.
      const { count } = await db.user.deleteMany({
        where: { id: account.id, deletionRequestedAt: { lte: cutoff } },
      });
      if (count > 0) processed++;
    } catch {
      // One account's failure (a transient blob error) shouldn't abort the
      // rest of the batch — it's still past its grace period tomorrow and
      // gets picked up on the next run.
      failed++;
    }
  }

  return { processed, failed };
}
