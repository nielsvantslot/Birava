/** Resets the database to a known-empty state between integration tests. */
export interface IDatabaseReset {
  reset(): Promise<void>;
}
