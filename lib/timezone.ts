import { cookies } from "next/headers";
import { isValidTimeZone } from "@/lib/dates";

export const TZ_COOKIE = "birava_tz";

/**
 * The user's IANA time zone, set client-side by <TimezoneSync /> on first
 * load. Falls back to UTC on the very first request before the cookie
 * exists. Server components pass this to the lib/dates helpers so all
 * day/week math happens in the user's local time, not the server's.
 */
export async function getUserTimeZone(): Promise<string> {
  const store = await cookies();
  const tz = store.get(TZ_COOKIE)?.value;
  return tz && isValidTimeZone(tz) ? tz : "UTC";
}
