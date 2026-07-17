import type { EntryAuthorDTO } from "./entryAuthorDTO";

export class DrinkEntryDTO {
  declare id: string;
  declare userId: string;
  declare drinkName: string | null;
  declare drinkType: string;
  declare venue: string | null;
  declare lat: number | null; // Prisma Decimal -> number
  declare lng: number | null; // Prisma Decimal -> number
  declare notes: string | null;
  declare photoUrl: string | null;
  declare photoLqip: string | null;
  declare createdAt: string; // Prisma Date -> ISO string
  declare user?: EntryAuthorDTO;
}
