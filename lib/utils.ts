import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/** "1st", "2nd", "3rd", "4th"... — used for crew leaderboard rank display. */
export function ordinal(n: number): string {
  const rem10 = n % 10;
  const rem100 = n % 100;
  if (rem10 === 1 && rem100 !== 11) return `${n}st`;
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`;
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`;
  return `${n}th`;
}

export function drinkPhotoSrc(entryId: string, size?: "thumb") {
  return size ? `/api/photos/${entryId}?size=${size}` : `/api/photos/${entryId}`;
}

/** Avatars are stored as private blobs (like check-in photos) — always render through this proxy, never the raw stored URL directly. */
export function avatarSrc(userId: string) {
  return `/api/avatars/${userId}`;
}
