/** Shared `deletionRequestedAt` exclusion — a user mid-GDPR-erasure grace
 * period is hidden from everyone else for the whole window, not just after
 * the purge (see CLAUDE.md's "Account deletion" section). Centralized so a
 * new query that should exclude them can't forget to. */
export const VISIBLE_USER_WHERE = { deletionRequestedAt: null } as const;
