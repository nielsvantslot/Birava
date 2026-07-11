import { db } from "@/lib/db";
import { ToggleCheerResultDTO } from "@/lib/dtos";
import { queueNotifications } from "@/lib/notify";

export async function toggleCheer(
  userId: string,
  entryId: string,
  actor: { username: string; avatarUrl: string | null }
): Promise<ToggleCheerResultDTO> {
  const key = { entryId_userId: { entryId, userId } };
  const existing = await db.cheer.findUnique({ where: key });

  try {
    if (existing) {
      await db.cheer.delete({ where: key });
    } else {
      await db.cheer.create({ data: { entryId, userId } });
    }
  } catch {
    return { error: "Failed to cheer" };
  }

  const count = await db.cheer.count({ where: { entryId } });

  if (!existing) {
    const entry = await db.drinkEntry.findUnique({ where: { id: entryId }, select: { userId: true } });
    if (entry) {
      queueNotifications([
        {
          userId: entry.userId,
          type: "CHEER",
          actorId: userId,
          actorUsername: actor.username,
          actorAvatarUrl: actor.avatarUrl,
          entryId,
        },
      ]);
    }
  }

  return { on: !existing, count };
}
