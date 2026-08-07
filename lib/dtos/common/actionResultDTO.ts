/** Shared shape for server-action results that carry no extra data on success. */
export class ActionResultDTO {
  declare error?: string;
  /**
   * The exact paths this mutation just told Next's server-side cache were
   * stale (the same list passed to revalidatePath) — the client uses this
   * to evict the matching service-worker cache entries (lib/swCache.ts),
   * since the SW's own page cache is a second, separate cache Next's
   * revalidation has no way to reach on its own.
   */
  declare revalidatedPaths?: string[];
}
