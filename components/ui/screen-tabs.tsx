"use client";

import Link from "next/link";
import { showToast } from "@/components/ui/toast-pill";
import { cn } from "@/lib/utils";

export type ScreenTab = {
  label: string;
  /** Navigate on tap */
  href?: string;
  /** Show a "coming soon"-style toast on tap instead of navigating */
  toast?: string;
  active?: boolean;
};

export function ScreenTabs({ tabs }: { tabs: ScreenTab[] }) {
  return (
    <div className="tabs">
      {tabs.map((tab) =>
        tab.href ? (
          <Link key={tab.label} href={tab.href} className={cn(tab.active && "on")}>
            {tab.label}
          </Link>
        ) : (
          <button
            key={tab.label}
            className={cn(tab.active && "on")}
            onClick={() => tab.toast && showToast(tab.toast)}
          >
            {tab.label}
          </button>
        )
      )}
    </div>
  );
}
