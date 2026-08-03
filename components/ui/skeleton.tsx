import * as React from "react";
import { cn } from "@/lib/utils";

// Base pulsing block — use className to control size/shape.
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn("bg-[var(--muted)] animate-pulse rounded", className)}
      style={style}
    />
  );
}

// Standard page header: large title line + smaller subtitle line.
export function SkeletonPageHeader({
  titleWidth = "w-32",
  subtitleWidth = "w-44",
}: {
  titleWidth?: string;
  subtitleWidth?: string;
}) {
  return (
    <div>
      <Skeleton className={cn("h-8 rounded-lg", titleWidth)} />
      <Skeleton className={cn("h-4 mt-1.5", subtitleWidth)} />
    </div>
  );
}

// Card shell matching the app's card style.
export function SkeletonCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[var(--card)] p-4",
        className
      )}
    >
      {children}
    </div>
  );
}

// A card row: circular avatar on the left + two text lines.
export function SkeletonAvatarRow({
  avatarSize = "h-10 w-10",
  line1Width = "w-32",
  line2Width = "w-20",
  right,
}: {
  avatarSize?: string;
  line1Width?: string;
  line2Width?: string;
  right?: React.ReactNode;
}) {
  return (
    <SkeletonCard>
      <div className="flex items-center gap-3">
        <Skeleton className={cn("rounded-full shrink-0", avatarSize)} />
        <div className="flex-1 space-y-2">
          <Skeleton className={cn("h-4", line1Width)} />
          <Skeleton className={cn("h-3", line2Width)} />
        </div>
        {right}
      </div>
    </SkeletonCard>
  );
}

// Input + button row used inside create/join-group cards.
export function SkeletonInputRow({ buttonWidth = "w-20" }: { buttonWidth?: string }) {
  return (
    <div className="flex gap-2">
      <Skeleton className="h-10 flex-1 rounded-lg" />
      <Skeleton className={cn("h-10 rounded-lg", buttonWidth)} />
    </div>
  );
}

// A single .row item (app/globals.css): 42px .rowmark circle + title/subtitle
// + optional chevron — the app's real list-row shape, used for recent
// sessions, achievement teasers, and nav rows (Find people, etc.) alike.
export function SkeletonRow({
  chev = true,
  line1Width = "w-40",
  line2Width = "w-28",
}: {
  chev?: boolean;
  line1Width?: string;
  line2Width?: string;
}) {
  return (
    <div className="row">
      <Skeleton className="h-[42px] w-[42px] rounded-full shrink-0" />
      <div className="grow space-y-1.5">
        <Skeleton className={cn("h-4", line1Width)} />
        <Skeleton className={cn("h-3", line2Width)} />
      </div>
      {chev && <Skeleton className="h-4 w-2.5 shrink-0" />}
    </div>
  );
}

// Profile head: .section.flush > .profile-head (avatar + name + meta line,
// one line — not two) + a 4-stat row. Shared by app/(app)/profile/page.tsx
// and app/(app)/profile/[username]/page.tsx so their route-level loading.tsx
// and Suspense fallback can't drift apart.
export function ProfileHeadSkeleton({
  showFollowButton = false,
}: {
  showFollowButton?: boolean;
}) {
  return (
    <div className="section flush">
      <div className="profile-head">
        <Skeleton className="h-16 w-16 rounded-full shrink-0" />
        <div style={{ flex: 1, minWidth: 0 }} className="space-y-2">
          <Skeleton className="h-[23px] w-32" />
          <Skeleton className="h-3.5 w-48" />
        </div>
        {showFollowButton && (
          <Skeleton className="h-8 w-20 rounded-lg shrink-0" />
        )}
      </div>
      <div style={{ padding: "0 16px 20px" }}>
        <div className="stats">
          {[0, 1, 2, 3].map((i) => (
            <div className="stat" key={i}>
              <Skeleton className="h-[12.5px] w-16 mb-1" />
              <Skeleton className="h-6 w-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// "Recent sessions" .section + .h-row header (title, optional trailing link)
// + N SkeletonRows. Shared by profile/page.tsx and profile/[username]/page.tsx.
export function RecentSessionsSkeleton({
  showHeaderLink = false,
  rows = 3,
}: {
  showHeaderLink?: boolean;
  rows?: number;
}) {
  return (
    <div className="section">
      <div className="h-row">
        <Skeleton className="h-5 w-36" />
        {showHeaderLink && <Skeleton className="h-3.5 w-8" />}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

// Stats page's five real sections (app/(app)/stats/page.tsx) — built from the
// app's own .section/.stats/.weeks/.barrow/.row classes, not the generic
// Tailwind card shell, so nothing pops in unskeletoned. Shared between
// stats/loading.tsx and StatsBody's Suspense fallback so they can't drift.
export function StatsBodySkeleton() {
  return (
    <>
      {/* All time */}
      <div className="section">
        <div className="h-row" style={{ marginBottom: 16 }}>
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="stats big">
          {[0, 1, 2].map((i) => (
            <div className="stat" key={i}>
              <Skeleton className="h-[13px] w-16 mb-1.5" />
              <Skeleton className="h-[30px] w-10" />
            </div>
          ))}
        </div>
      </div>

      {/* active-weeks streak */}
      <div className="section">
        <div className="h-row" style={{ marginBottom: 2 }}>
          <Skeleton className="h-5 w-44" />
        </div>
        <div className="stats" style={{ marginTop: 12 }}>
          {[0, 1].map((i) => (
            <div className="stat" key={i}>
              <Skeleton className="h-[13px] w-16 mb-1.5" />
              <Skeleton className="h-6 w-10 mb-1.5" />
              <Skeleton className="h-[11px] w-28" />
            </div>
          ))}
        </div>
        <div className="weeks">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-lg" style={{ flex: 1 }} />
          ))}
        </div>
        <div className="weeks-legend">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>

      {/* sessions per week chart — viewBox is 358x150, so the skeleton box
          matches that aspect ratio instead of a generic h-48 rectangle */}
      <div className="section">
        <Skeleton className="h-[13px] w-40 mb-1.5" />
        <Skeleton
          className="rounded-lg w-full"
          style={{ aspectRatio: "358 / 150" }}
        />
      </div>

      {/* discovery: types explored */}
      <div className="section">
        <div className="h-row" style={{ marginBottom: 8 }}>
          <Skeleton className="h-5 w-32" />
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div className="barrow" key={i}>
            <Skeleton className="h-3.5 w-[78px] shrink-0" />
            <div className="track" style={{ flex: 1 }}>
              <Skeleton className="h-full w-full" />
            </div>
            <Skeleton className="h-3.5 w-6 shrink-0" />
          </div>
        ))}
        <div className="stats" style={{ marginTop: 18 }}>
          {[0, 1, 2].map((i) => (
            <div className="stat" key={i}>
              <Skeleton className="h-[13px] w-16 mb-1.5" />
              <Skeleton className="h-6 w-8" />
            </div>
          ))}
        </div>
      </div>

      {/* achievements teaser — .row + .rowmark.ach (42px circle), same as
          other row-based lists, NOT the /achievements page's ac-ic squircle */}
      <div className="section">
        <div className="h-row">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3.5 w-14" />
        </div>
        {[0, 1].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    </>
  );
}

// A dashboard-feed session card's shape — built from the app's own native
// classes (.who, .act-title, .act-stats, .card-photo, .social.acts —
// app/globals.css), not the generic Tailwind card shell the rest of this
// file uses, since the real SessionCard doesn't use that shell either.
// Shared between app/(app)/dashboard/loading.tsx and dashboard/page.tsx's
// FeedSkeleton so the two can't drift apart the way stats's did.
export function SessionCardSkeleton() {
  return (
    <div className="section flush">
      <div className="who">
        <Skeleton className="h-[42px] w-[42px] rounded-full shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <div style={{ padding: "2px 16px 12px" }}>
        <Skeleton className="h-6 w-48" />
      </div>
      <div className="act-stats">
        <div className="stats">
          {[0, 1, 2].map((i) => (
            <div className="stat" key={i}>
              <Skeleton className="h-3 w-14 mb-1.5" />
              <Skeleton className="h-5 w-10" />
            </div>
          ))}
        </div>
      </div>
      <div className="card-photo">
        <div className="card-photo-frame">
          <Skeleton className="absolute inset-0 rounded-none" />
        </div>
      </div>
      <div className="social acts">
        {/* .act's own margin-right creates the real gap between icons — this
            row isn't built from .act elements, so the spacing is added here
            explicitly instead of relying on .social.acts's gap:0. */}
        <Skeleton className="h-5 w-16 mr-6" />
        <Skeleton className="h-5 w-20 mr-6" />
        <Skeleton className="h-5 w-14" />
      </div>
    </div>
  );
}
