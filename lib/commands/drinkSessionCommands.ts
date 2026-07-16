import { db } from "@/lib/db";
import { ActionResultDTO, RenameSessionDTO } from "@/lib/dtos";

const MAX_SESSION_NAME_LENGTH = 40;

export async function renameSession(
  userId: string,
  input: RenameSessionDTO
): Promise<ActionResultDTO> {
  const existing = await db.drinkSession.findUnique({
    where: { id: input.id },
    select: { userId: true },
  });
  if (!existing || existing.userId !== userId) {
    return { error: "Session not found" };
  }

  const trimmed = input.name?.trim() || null;
  if (trimmed && trimmed.length > MAX_SESSION_NAME_LENGTH) {
    return { error: "Session name is too long" };
  }

  await db.drinkSession.update({
    where: { id: input.id },
    // The session title is part of the cached share image, so a rename
    // invalidates it the same way an entry change does (see
    // lib/commands/drinkEntryCommands.ts).
    data: { name: trimmed, shareImageOpaqueUrl: null, shareImageTransparentUrl: null },
  });

  return {};
}
