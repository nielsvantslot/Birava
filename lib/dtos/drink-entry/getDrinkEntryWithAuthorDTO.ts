import type { EntryAuthorDTO } from "./entryAuthorDTO";

/** Variant for call sites that always fetch the entry WITH its author (feed, group gallery, leaderboard input). */
export class DrinkEntryWithAuthorDTO {
  declare id: string;
  declare userId: string;
  declare groupId: string | null;
  declare drinkName: string | null;
  declare brewery: string | null;
  declare style: string | null;
  declare amount: number;
  declare notes: string | null;
  declare photoUrl: string | null;
  declare photoLqip: string | null;
  declare createdAt: string;
  declare user: EntryAuthorDTO;
}
