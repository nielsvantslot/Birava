import { db } from "@/lib/db";
import { ToggleProostResultDTO } from "@/lib/dtos";

export async function toggleProost(userId: string, entryId: string): Promise<ToggleProostResultDTO> {
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
  return { on: !existing, count };
}
