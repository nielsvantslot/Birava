import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserTimeZone } from "@/lib/timezone";
import {
  getMyDrinkEntry,
  getMyRecentDrinks,
} from "@/lib/controllers/drinkController";
import { DrinkEntry } from "@/lib/types";
import { relativeDay } from "@/lib/dates";
import { CheckinForm } from "@/components/drink/log-drink-form";
import { PendingCheckinsPanel } from "@/components/drink/pending-checkins-panel";
import { RecentDrinkRow } from "@/components/drink/recent-drink-row";
import { drinkPhotoService } from "@/lib/photoUpload";

function recentMeta(entry: DrinkEntry, tz: string): string {
  return [
    entry.drink_type,
    relativeDay(new Date(entry.created_at), tz).toLowerCase(),
    entry.venue,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { edit } = await searchParams;
  // Only the edit case has a real reason to wait before the form can render
  // (it needs the entry to prefill) — a plain "new check-in" visit needs no
  // server data at all. The Recent list below is a separate, independent
  // fetch (RecentDrinksLoader) that streams in behind its own Suspense
  // instead of gating the form on data it doesn't use.
  const editEntry = edit ? ((await getMyDrinkEntry({ id: edit })) ?? undefined) : undefined;

  return (
    <>
      <div className="section">
        <div className="h-row" style={{ marginBottom: 4 }}>
          <h3>{editEntry ? "Edit check-in" : "Log a drink"}</h3>
        </div>
        <p style={{ fontSize: 14, color: "var(--ink-dim)", marginBottom: 18 }}>
          {editEntry
            ? "Fix the details, keep the memory."
            : "Thirty seconds. Then back to drinking it."}
        </p>
        <CheckinForm
          key={editEntry?.id ?? "new"}
          editEntry={editEntry}
          userId={user.id}
          supportsDirectUpload={drinkPhotoService.supportsDirectUpload}
        />
      </div>

      <PendingCheckinsPanel userId={user.id} supportsDirectUpload={drinkPhotoService.supportsDirectUpload} />

      <Suspense fallback={<RecentDrinksSkeleton />}>
        <RecentDrinksLoader userId={user.id} supportsDirectUpload={drinkPhotoService.supportsDirectUpload} />
      </Suspense>
    </>
  );
}

async function RecentDrinksLoader({
  userId,
  supportsDirectUpload,
}: {
  userId: string;
  supportsDirectUpload: boolean;
}) {
  const [tz, recent] = await Promise.all([
    getUserTimeZone(),
    getMyRecentDrinks({ limit: 4 }),
  ]);

  return (
    <div className="section">
      <div className="h-row">
        <h3>Recent</h3>
      </div>
      {recent.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--ink-dim)" }}>
          Nothing logged yet — your first drink goes right here.
        </p>
      ) : (
        recent.map((entry) => (
          <RecentDrinkRow
            key={entry.id}
            entry={entry}
            meta={recentMeta(entry, tz)}
            userId={userId}
            supportsDirectUpload={supportsDirectUpload}
          />
        ))
      )}
    </div>
  );
}

function RecentDrinksSkeleton() {
  return (
    <div className="section" style={{ minHeight: 160 }}>
      <div className="h-row">
        <h3>Recent</h3>
      </div>
    </div>
  );
}
