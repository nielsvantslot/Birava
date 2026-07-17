"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const TITLES: Array<[prefix: string, title: string]> = [
  ["/dashboard", "Home"],
  ["/stats", "Stats"],
  ["/log", "Log"],
  ["/sessions/", "Session"],
  ["/achievements", "Achievements"],
  ["/notifications", "Notifications"],
  ["/crews/", "Crew"],
  ["/crews", "Crews"],
  ["/profile/", "Profile"],
  ["/profile", "You"],
  ["/people", "Find people"],
  ["/settings", "Settings"],
];

/** Detail screens show a back arrow instead of the avatar. */
const BACK_PREFIXES = ["/sessions/", "/achievements", "/notifications", "/people", "/profile/", "/settings"];

interface AppHeaderProps {
  username?: string;
  avatarUrl?: string | null;
  unreadCount?: number;
}

export function AppHeader({ username, avatarUrl, unreadCount = 0 }: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  const title =
    TITLES.find(([prefix]) =>
      prefix.endsWith("/")
        ? pathname.startsWith(prefix) && pathname !== prefix.slice(0, -1)
        : pathname === prefix || pathname.startsWith(prefix + "/")
    )?.[1] ?? "Birava";

  const isCrewDetail =
    pathname.startsWith("/crews/") && pathname !== "/crews";
  const showBack =
    isCrewDetail ||
    BACK_PREFIXES.some((prefix) =>
      prefix.endsWith("/")
        ? pathname.startsWith(prefix) && pathname !== prefix.slice(0, -1)
        : pathname === prefix || pathname.startsWith(prefix + "/")
    );

  return (
    <header className={cn("header sticky top-0 z-40", !showBack && "md:!hidden")}>
      <div className="left">
        {showBack ? (
          <button
            className="hicon back"
            aria-label="Back"
            onClick={() => router.back()}
          >
            <svg viewBox="0 0 24 24">
              <path d="M15 5l-7 7 7 7"></path>
            </svg>
          </button>
        ) : (
          <Link className="hicon avatar-btn" href="/profile" aria-label="Your profile">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={username ?? "You"} />
            ) : (
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="8" r="4"></circle>
                <path d="M4 21c0-4 3.5-6 8-6s8 2 8 6"></path>
              </svg>
            )}
          </Link>
        )}
      </div>
      <div className="title">{title}</div>
      <div className="right">
        <Link className="hicon" href="/notifications" aria-label="Notifications">
          <svg viewBox="0 0 24 24">
            <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.7 21a2 2 0 01-3.4 0"></path>
          </svg>
          {unreadCount > 0 && (
            <span className="badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
          )}
        </Link>
      </div>
    </header>
  );
}
