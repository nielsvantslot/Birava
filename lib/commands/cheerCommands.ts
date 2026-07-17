import { db } from "@/lib/db";
import { ToggleCheerResultDTO } from "@/lib/dtos";
import { queueNotifications } from "@/lib/notify";

export async function toggleCheer(
  userId: string,
  sessionId: string,
  actor: { username: string; avatarUrl: string | null }
): Promise<ToggleCheerResultDTO> {
  const key = { sessionId_userId: { sessionId, userId } };
  const existing = await db.cheer.findUnique({ where: key });

  try {
    if (existing) {
      await db.cheer.delete({ where: key });
    } else {
      await db.cheer.create({ data: { sessionId, userId } });
    }
  } catch {
    return { error: "Failed to cheer" };
  }

  const count = await db.cheer.count({ where: { sessionId } });

  if (!existing) {
    const session = await db.drinkSession.findUnique({ where: { id: sessionId }, select: { userId: true } });
    if (session) {
      queueNotifications([
        {
          userId: session.userId,
          type: "CHEER",
          actorId: userId,
          actorUsername: actor.username,
          actorAvatarUrl: actor.avatarUrl,
          entryId: sessionId,
        },
      ]);
    }
  }

  return { on: !existing, count };
}
