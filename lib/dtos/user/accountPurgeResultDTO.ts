/** Result of a purgeExpiredDeletedAccounts run — how many accounts past the grace period it processed, and how many it couldn't finish. */
export class AccountPurgeResultDTO {
  declare processed: number;
  declare failed: number;
}
