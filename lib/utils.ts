import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function drinkPhotoSrc(entryId: string, size?: "thumb") {
  return size ? `/api/photos/${entryId}?size=${size}` : `/api/photos/${entryId}`;
}

/** Avatars are stored as private blobs (like check-in photos) — always render through this proxy, never the raw stored URL directly. */
export function avatarSrc(userId: string) {
  return `/api/avatars/${userId}`;
}

/**
 * Dynamic route segments (e.g. `[username]`) arrive from `params` still
 * percent-encoded in this app's Next.js version — a username containing a
 * space or other reserved character (allowed; see userCommands.ts, which
 * only trims, never restricts the charset) round-trips through a profile
 * link as literally "Some%20User", not "Some User", so it must be decoded
 * before use as an exact-match DB lookup value or it will never match a
 * real row. Returns null for a malformed percent-sequence so callers can
 * notFound() it the same as any other nonexistent username.
 */
export function decodeUsernameParam(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}
