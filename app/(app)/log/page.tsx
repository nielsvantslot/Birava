import Link from "next/link";
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

  // Independent reads — run in parallel (F2).
  const [tz, editEntryOrNull, recent] = await Promise.all([
    getUserTimeZone(),
    edit ? getMyDrinkEntry({ id: edit }) : Promise.resolve(null),
    getMyRecentDrinks({ limit: 4 }),
  ]);
  const editEntry: DrinkEntry | undefined = editEntryOrNull ?? undefined;

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
            <Link
              key={entry.id}
              href={`/log?edit=${entry.id}`}
              className="row"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div className="rowmark">
                <svg viewBox="0 0 24 24">
                  <path d="M9 3h6M12 3v4"></path>
                  <path d="M7 21c-2 0-3-1.6-3-3.5C4 13 7 11 12 11s8 2 8 6.5c0 1.9-1 3.5-3 3.5z"></path>
                </svg>
              </div>
              <div className="grow">
                <b>{entry.drink_name?.trim() || entry.drink_type}</b>
                <span>{recentMeta(entry, tz)}</span>
              </div>
              <span className="chev">›</span>
            </Link>
          ))
        )}
      </div>
    </>
  );
}
