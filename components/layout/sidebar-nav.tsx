"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SidebarNavProps {
  username?: string;
  avatarUrl?: string | null;
  unreadCount?: number;
}

export function SidebarNav({ username, avatarUrl, unreadCount = 0 }: SidebarNavProps) {
  return (
    <Suspense fallback={<SidebarInner pathname="" username={username} avatarUrl={avatarUrl} unreadCount={unreadCount} />}>
      <SidebarInnerWithPathname username={username} avatarUrl={avatarUrl} unreadCount={unreadCount} />
    </Suspense>
  );
}

function SidebarInnerWithPathname(props: SidebarNavProps) {
  const pathname = usePathname();
  return <SidebarInner pathname={pathname} {...props} />;
}

function SidebarInner({
  pathname,
  username,
  avatarUrl,
  unreadCount = 0,
}: SidebarNavProps & { pathname: string }) {
  const router = useRouter();

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="sidebar hidden md:flex md:w-[76px] xl:w-60 fixed left-0 top-0 h-screen z-40">
      <Link href="/dashboard" className="sidebar-brand" aria-label="Birava home">
        <svg viewBox="0 0 24 24">
          <path d="M7 3h9l-1 4h1.5a1 1 0 011 1.2l-1.8 9A2 2 0 0114 19h-5a2 2 0 01-1.97-1.8L5 8.2A1 1 0 016 7h1z"></path>
          <path d="M15.5 10.5H19a1 1 0 011 1v1a2 2 0 01-2 2h-1.2"></path>
          <path d="M9 3v4"></path>
        </svg>
        <span>Birava</span>
      </Link>

      <nav className="sidebar-nav">
        <Link
          href="/notifications"
          className={cn(
            pathname === "/notifications" || pathname.startsWith("/notifications/") ? "active" : undefined
          )}
        >
          <svg viewBox="0 0 24 24">
            <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.7 21a2 2 0 01-3.4 0"></path>
          </svg>
          {unreadCount > 0 && (
            <span className="badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
          )}
          <span className="label">Notifications</span>
        </Link>
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          const isProfile = href === "/profile";
          return (
            <Link key={href} href={href} className={cn(active && "active")}>
              {isProfile && avatarUrl ? (
                <span className="sidebar-avatar">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={avatarUrl} alt="" />
                </span>
              ) : (
                icon
              )}
              <span className="label">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-more">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label="More">
              <svg viewBox="0 0 24 24">
                <path d="M4 7h16M4 12h16M4 17h16"></path>
              </svg>
              <span className="label">More</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-48">
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
    </aside>
  );
}
