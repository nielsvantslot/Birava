/**
 * Shared between next.config.ts (images.deviceSizes) and the photos route's
 * responsive ?w= allowlist (app/api/photos/[entryId]/route.ts), so the
 * session card's custom next/image loader can only ever request widths our
 * route actually serves.
 */
// Each step is at most ~20% bigger than the last, so no device/DPR
// combination lands more than ~20% over its real need.
export const HERO_WIDTHS = [384, 480, 576, 672, 768, 960, 1080];

export const THUMB_WIDTH = 400;
