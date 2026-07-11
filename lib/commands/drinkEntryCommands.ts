import { db } from "@/lib/db";
import { computeAchievements } from "@/lib/achievements";
import { SESSION_GAP_MS } from "@/lib/sessions";
import { getUserTimeZone } from "@/lib/timezone";
import { toDrinkEntry } from "@/lib/mappers";
import { removeDrinkPhotoByUrl } from "@/lib/storage";
import { getFollowerIds } from "@/lib/queries/followQueries";
import { queueNotifications, type NotificationEvent } from "@/lib/notify";
import {
  ActionResultDTO,
  AddDrinkResultDTO,
  CreateDrinkEntryDTO,
  DeleteDrinkEntryDTO,
  UpdateDrinkEntryDTO,
} from "@/lib/dtos";

export async function createDrinkEntry(
  userId: string,
  input: CreateDrinkEntryDTO,
  actor: { username: string; avatarUrl: string | null }
): Promise<AddDrinkResultDTO> {
  const tz = await getUserTimeZone();
  // Read history once; the "after" set is provably "before + the new row",
  // so there's no need for a second full-table scan.
  const before = await db.drinkEntry.findMany({ where: { userId } });

  let created;
  try {
    created = await db.drinkEntry.create({
      data: {
        userId,
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

  // A new session starts when there's no prior check-in, or the last one is
  // more than the 4-hour gap before this one — mirrors groupIntoSessions.
  const lastPriorMs = before.length
    ? Math.max(...before.map((e) => e.createdAt.getTime()))
    : null;
  const isSessionStart = lastPriorMs === null || created.createdAt.getTime() - lastPriorMs > SESSION_GAP_MS;

  if (isSessionStart) {
    const followerIds = await getFollowerIds(userId);
    events.push(
      ...followerIds.map((followerId) => ({
        userId: followerId,
        type: "SESSION_START" as const,
        actorId: userId,
        actorUsername: actor.username,
        actorAvatarUrl: actor.avatarUrl,
        entryId: created.id,
      }))
    );
  }

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
        type: "CREW_CHECKIN" as const,
        actorId: userId,
        actorUsername: actor.username,
        actorAvatarUrl: actor.avatarUrl,
        entryId: created.id,
        groupId: m.groupId,
        groupName: groupNames.get(m.groupId),
      }))
    );
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
    select: { photoUrl: true },
  });
  if (!existing) return { error: "Check-in not found" };

  try {
    await db.drinkEntry.updateMany({
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
  } catch {
    return { error: "Failed to update check-in." };
  }

  if (existing.photoUrl && existing.photoUrl !== input.photoUrl) {
    await removeDrinkPhotoByUrl(existing.photoUrl);
  }

  return {};
}

export async function deleteDrinkEntry(
  userId: string,
  input: DeleteDrinkEntryDTO
): Promise<ActionResultDTO> {
  const entry = await db.drinkEntry.findFirst({
    where: { id: input.id, userId },
    select: { photoUrl: true },
  });

  try {
    await db.drinkEntry.deleteMany({ where: { id: input.id, userId } });
  } catch {
    return { error: "Failed to delete check-in." };
  }

  if (entry?.photoUrl) {
    await removeDrinkPhotoByUrl(entry.photoUrl);
  }

  return {};
}
