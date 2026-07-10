"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TITLES: Array<[prefix: string, title: string]> = [
  ["/dashboard", "Home"],
  ["/stats", "Stats"],
  ["/log", "Log"],
  ["/sessions/", "Session"],
  ["/achievements", "Achievements"],
  ["/crews/", "Crew"],
  ["/crews", "Crews"],
  ["/profile/", "Profile"],
  ["/profile", "You"],
  ["/people", "Find people"],
];

/** Detail screens show a back arrow instead of the avatar. */
const BACK_PREFIXES = ["/sessions/", "/achievements", "/people", "/profile/"];

interface AppHeaderProps {
  username?: string;
  avatarUrl?: string | null;
}

export function AppHeader({ username, avatarUrl }: AppHeaderProps) {
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

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

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
        <Link className="hicon" href="/log" aria-label="Log a drink">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9.5"></circle>
            <path d="M12 8v8M8 12h8"></path>
          </svg>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="hicon" aria-label="Settings">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 00-2-1.2L14.2 3h-4l-.4 2.5a7 7 0 00-2 1.2l-2.3-1-2 3.4 2 1.5a7 7 0 000 2.4l-2 1.5 2 3.4 2.3-1a7 7 0 002 1.2l.4 2.5h4l.4-2.5a7 7 0 002-1.2l2.3 1 2-3.4-2-1.5c.06-.4.1-.8.1-1.2z"></path>
              </svg>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-3 py-2">
              <p className="text-sm font-semibold">{username ?? "User"}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile" className="cursor-pointer">
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/people" className="cursor-pointer">
                Find people
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/achievements" className="cursor-pointer">
                Achievements
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleSignOut}
              className="cursor-pointer text-[var(--destructive)]"
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
