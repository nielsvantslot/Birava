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
