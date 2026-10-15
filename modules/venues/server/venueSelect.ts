/** Shared `venue` include fragment — every query that reads a check-in's
 * venue/location needs this exact shape (see CLAUDE.md's venue-include
 * landmine); centralized so a field addition/removal can't be applied to
 * some call sites and forgotten in others. */
export const VENUE_SELECT = { select: { name: true, lat: true, lng: true } } as const;
