export class CreateDrinkEntryDTO {
  declare drinkName: string | null;
  declare drinkType: string;
  declare venue: string | null;
  declare lat: number | null;
  declare lng: number | null;
  declare notes: string | null;
  declare photoUrl: string | null;
  declare photoLqip: string | null;
  /** Client epoch ms, for offline-sync recovering a check-in logged in the
   * past — the server clamps this (see MAX_BACKDATE_MS), it never trusts it
   * outright. Omit for a real-time check-in (defaults to now()). */
  declare createdAt?: number | null;
}
