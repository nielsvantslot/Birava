/** Shared "who did this" select fragment — the small user-identity shape
 * (id, username, avatar, dev badge) repeated at every place a check-in,
 * comment, follow, or crew-member row needs to show its author. Centralized
 * so a field addition/removal can't be applied to some call sites and
 * forgotten in others (same rationale as VENUE_SELECT). Not for
 * lib/auth/session.ts's session payload — that's a different concept
 * (the current user's own identity, including email) with its own shape. */
export const AUTHOR_FIELDS = { id: true, username: true, avatarUrl: true, isDeveloper: true } as const;

/** `AUTHOR_FIELDS`, pre-wrapped for a nested relation select (e.g. `user: AUTHOR_SELECT`). For a direct `db.user.findMany({ select: ... })`, use `AUTHOR_FIELDS` itself. */
export const AUTHOR_SELECT = { select: AUTHOR_FIELDS } as const;
