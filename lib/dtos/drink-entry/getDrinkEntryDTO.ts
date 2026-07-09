import type { EntryAuthorDTO } from "./entryAuthorDTO";

export class DrinkEntryDTO {
  declare id: string;
  declare userId: string;
  declare groupId: string | null;
  declare drinkName: string | null;
  declare brewery: string | null;
  declare style: string | null;
  declare amount: number; // Prisma Decimal -> number
  declare notes: string | null;
  declare photoUrl: string | null;
  declare createdAt: string; // Prisma Date -> ISO string
  declare user?: EntryAuthorDTO;
}
