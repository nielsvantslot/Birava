"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const TZ_COOKIE = "birava_tz";

/**
 * Stores the browser's IANA time zone in a cookie so server components can
 * render dates/sessions in the user's local time (see lib/timezone.ts).
 * Refreshes once if the cookie was missing or stale so the first paint's
 * UTC fallback corrects itself.
 */
export function TimezoneSync() {
  const router = useRouter();

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return;
    const current = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${TZ_COOKIE}=`))
      ?.split("=")[1];
    if (current === tz) return;
    document.cookie = `${TZ_COOKIE}=${tz}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [router]);

  return null;
}
