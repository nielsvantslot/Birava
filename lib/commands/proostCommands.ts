import { db } from "@/lib/db";
import { ToggleProostResultDTO } from "@/lib/dtos";
import { queueNotifications } from "@/lib/notify";

export async function toggleProost(
  userId: string,
  entryId: string,
  actor: { username: string; avatarUrl: string | null }
): Promise<ToggleProostResultDTO> {
  const key = { entryId_userId: { entryId, userId } };
  const existing = await db.proost.findUnique({ where: key });

  try {
    if (existing) {
      await db.proost.delete({ where: key });
    } else {
      await db.proost.create({ data: { entryId, userId } });
    }
  } catch {
    return { error: "Failed to proost" };
  }

  const count = await db.proost.count({ where: { entryId } });

  if (!existing) {
    const entry = await db.drinkEntry.findUnique({ where: { id: entryId }, select: { userId: true } });
    if (entry) {
      queueNotifications([
        {
          userId: entry.userId,
          type: "PROOST",
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
