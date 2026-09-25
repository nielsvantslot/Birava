import type { DrinkType } from "@/lib/types";

export class CreateDrinkEntryDTO {
  declare drinkName: string | null;
  declare drinkType: DrinkType;
  declare venue: string | null;
  declare lat: number | null;
  declare lng: number | null;
  declare photoUrl: string | null;
  declare photoLqip: string | null;
  /** Client epoch ms, for offline-sync recovering a check-in logged in the
   * past — the server clamps this (see MAX_BACKDATE_MS), it never trusts it
   * outright. Omit for a real-time check-in (defaults to now()). */
  declare createdAt?: number | null;
  /** The offline queue's own client-generated id (crypto.randomUUID(), see
   * pendingCheckins.ts), doubling as an idempotency key: reused verbatim as
   * the DrinkEntry's id so a retried sync (client timeout after the server
   * actually succeeded, or two tabs flushing the same queued entry at once)
   * can't create a second row for the same logical check-in. Omit to get a
   * fresh server-generated id (no retry semantics needed). */
  declare clientId?: string | null;
}
