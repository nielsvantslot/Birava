"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Home",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1z"></path>
      </svg>
    ),
  },
  {
    href: "/stats",
    label: "Stats",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M4 20V10"></path>
        <path d="M10 20V4"></path>
        <path d="M16 20v-7"></path>
        <path d="M22 20H2"></path>
      </svg>
    ),
  },
  {
    href: "/log",
    label: "Log",
    icon: (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9.5"></circle>
        <path d="M12 8v8M8 12h8"></path>
      </svg>
    ),
  },
  {
    href: "/crews",
    label: "Crews",
    icon: (
      <svg viewBox="0 0 24 24">
        <circle cx="8" cy="9" r="3"></circle>
        <circle cx="16" cy="9" r="3"></circle>
        <path d="M2.5 19c.5-3 2.8-4.5 5.5-4.5S13 16 13.5 19"></path>
        <path d="M14.5 14.8c2.4.2 4.5 1.6 5 4.2"></path>
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "You",
    icon: (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4"></circle>
        <path d="M5 21c0-4 3-6 7-6s7 2 7 6z"></path>
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="navwrap fixed bottom-0 left-0 right-0 z-40">
      <nav className="nav">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href} className={cn(active && "active")}>
              {icon}
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
