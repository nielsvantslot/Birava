"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/components/layout/nav-items";

export function BottomNav() {
  return (
    <Suspense fallback={<NavInner pathname="" />}>
      <NavInnerWithPathname />
    </Suspense>
  );
}

function NavInnerWithPathname() {
  const pathname = usePathname();
  return <NavInner pathname={pathname} />;
}

function NavInner({ pathname }: { pathname: string }) {
  return (
    <div className="navwrap fixed bottom-0 left-0 right-0 z-40 md:hidden">
      <nav className="nav">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            // Prefetching a dynamic route's RSC payload here is pure waste —
            // staleTimes.dynamic is 0 (next.config.ts), so every navigation
            // refetches regardless of what's already prefetched.
            <Link key={href} href={href} className={cn(active && "active")} prefetch={false}>
              {icon}
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
