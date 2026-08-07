import { list, del } from "@vercel/blob";
import { db } from "@/lib/db";
import { BlobCleanupResultDTO } from "@/lib/dtos";

// A blob younger than this might still be legitimately unreferenced rather
// than abandoned: the offline queue (lib/offline/pendingCheckins.ts) can
// upload a photo and durably hold its URL for as long as the user is
// offline before the check-in itself ever reaches addDrink — a 24h window
// would delete that blob out from under a sync that hasn't happened yet,
// permanently breaking the photo once it does. 7 days matches two existing
// precedents: this app's own MAX_BACKDATE_MS (lib/sessions.ts) — the trust
// window it already treats as "a plausible delayed sync" — and AWS S3's
// AbortIncompleteMultipartUpload lifecycle rule, the closest industry analog
// to this exact problem, which also defaults to 7 days.
const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

// Top-level Blob path each service uses (lib/photoUploadConfig.ts's
// drinkPhotoKeyPrefix, lib/avatarPhotoConfig.ts's avatarKeyPrefix are both
// `{this}/${userId}` — listing the bare prefix covers every owner at once).
const PREFIXES = ["entries-photos/", "avatars/"] as const;

// Caps del() attempts per invocation. Each one is a real network round trip
// to Blob storage, and this route has no cooperative-cancellation signal to
// bail out on gracefully — a Vercel function timeout just kills the process
// mid-request. Bounding the work per run instead guarantees a clean, complete
// result within app/api/cron/cleanup-orphaned-blobs/route.ts's maxDuration —
// same idea as scripts/backfill-photo-derivatives.ts's 25-rows-per-run cap.
// Whatever's left over just gets picked up by tomorrow's run; nothing here
// depends on finishing the whole backlog in one pass.
const MAX_DELETE_ATTEMPTS_PER_RUN = 200;

/**
 * Direct-to-Blob uploads (modules/photo-upload's direct-upload path) write a
 * durable blob before any DB row exists to reference it — the DB write only
 * happens later, when the check-in form is submitted or the avatar finalize
 * route's own follow-up write succeeds. Abandon the form (navigate away,
 * close the tab) after the upload finished and nothing ever points at it —
 * the client's best-effort discard (log-drink-form.tsx's
 * discardPendingUpload) only fires on explicit in-app actions, not a killed
 * tab or crashed browser, so it can reduce but never eliminate this. This is
 * the backstop: list every blob under the two prefixes drink photos and
 * avatars actually use (lib/photoUploadConfig.ts, lib/avatarPhotoConfig.ts),
 * and delete whatever isn't referenced by any DrinkEntry.photoUrl or
 * User.avatarUrl and has sat there past the grace period.
 *
 * Meant to run on a schedule (app/api/cron/cleanup-orphaned-blobs/route.ts) —
 * Vercel Blob only, so this is a no-op outside production/staging, where
 * StorageAdapterFactory.create() would otherwise be using local disk instead.
 */
export async function cleanupOrphanedBlobs(): Promise<BlobCleanupResultDTO> {
  if (process.env.NODE_ENV !== "production") {
    return { scanned: 0, deleted: 0, failed: 0 };
  }

  const cutoff = new Date(Date.now() - GRACE_PERIOD_MS);

  // Prisma's `where: { ...: { not: null } }` filters rows at the DB level but
  // doesn't narrow the selected column's TS type — it's still `string | null`
  // — so the null case is excluded with a type guard rather than asserted.
  const isNonNull = <T>(value: T | null): value is T => value !== null;

  const [entryUrls, avatarUrls] = await Promise.all([
    db.drinkEntry
      .findMany({ where: { photoUrl: { not: null } }, select: { photoUrl: true } })
      .then((rows) => new Set(rows.map((r) => r.photoUrl).filter(isNonNull))),
    db.user
      .findMany({ where: { avatarUrl: { not: null } }, select: { avatarUrl: true } })
      .then((rows) => new Set(rows.map((r) => r.avatarUrl).filter(isNonNull))),
  ]);
  const referencedByPrefix: Record<(typeof PREFIXES)[number], Set<string>> = {
    "entries-photos/": entryUrls,
    "avatars/": avatarUrls,
  };

  let scanned = 0;
  let deleted = 0;
  let failed = 0;

  prefixLoop: for (const prefix of PREFIXES) {
    const referenced = referencedByPrefix[prefix];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor, limit: 1000 });
      cursor = page.cursor;

      for (const blob of page.blobs) {
        scanned++;
        if (blob.uploadedAt > cutoff) continue;
        if (referenced.has(blob.url)) continue;
        try {
          await del(blob.url);
          deleted++;
        } catch {
          // One blob's transient del() failure (network blip, or it was
          // already removed by an overlapping run) shouldn't abort the rest
          // of the sweep — it just stays orphaned for one more day and gets
          // picked up on the next scheduled run.
          failed++;
        }
        if (deleted + failed >= MAX_DELETE_ATTEMPTS_PER_RUN) break prefixLoop;
      }
    } while (cursor);
  }

  return { scanned, deleted, failed };
}
