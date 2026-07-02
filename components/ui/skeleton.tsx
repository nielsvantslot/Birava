import * as React from "react";
import { cn } from "@/lib/utils";

// Base pulsing block — use className to control size/shape.
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("bg-[var(--muted)] animate-pulse rounded", className)}
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
