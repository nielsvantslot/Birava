import { PhotoUploader } from "@/modules/photo-upload/client";
import { drinkPhotoUploadEndpoints } from "@/lib/photoUploadConfig";
import { addDrink } from "@/lib/controllers/drinkController";
import { triggerConfetti } from "@/lib/achievements";
import { showToast } from "@/components/ui/toast-pill";
import {
  getAllPendingCheckins,
  removePendingCheckin,
  updatePendingCheckin,
  type PendingCheckin,
} from "@/lib/offline/pendingCheckins";

let flushing = false;

// Neither PhotoUploader.upload nor the addDrink server action carry their own
// timeout — a genuinely hung network request (a stalled connection to Blob
// storage, an unresponsive function) previously left an entry stuck at
// "syncing" forever, with no escape: the Cancel button is deliberately
// hidden while "syncing" (see PendingCheckinsPanel), and nothing else ever
// revisits an entry already marked "syncing". Racing each step against this
// bounds the wait and hands control back to the user (via the "failed"
// status's Retry/Cancel buttons) instead of an unrecoverable hang. The
// underlying operation isn't actually cancelled (no AbortController plumbed
// through addDrink, which can't accept one — it's a Server Action) — it may
// still complete in the background, its result just discarded — but the
// user is never stuck again.
const SYNC_STEP_TIMEOUT_MS = 45_000;

class SyncTimeoutError extends Error {}

/**
 * Wraps a *completed* photo-upload rejection (PhotoUploadResultDto's error
 * variant), carrying its `retryable` flag through Promise.allSettled — a
 * plain `throw new Error(uploaded.error)` (the previous version of this)
 * lost that distinction entirely, so a deterministic rejection (unsupported
 * format, oversized file — see PhotoUploader.ts) and a transient one
 * (network drop) were handled identically: both got silently requeued as
 * "queued" forever, since only SyncTimeoutError was ever treated as
 * permanent. A permanently-broken photo would cycle queued → syncing →
 * queued indefinitely, always blamed on "waiting for connection" even
 * though connectivity was never the problem.
 */
class PhotoUploadRejectedError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean
  ) {
    super(message);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new SyncTimeoutError("Sync timed out — check your connection and try again.")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

type ResolvedPhoto = { url: string | null; lqip: string | null };

/**
 * Phase 1 of a flush: every entry's photo upload, kicked off concurrently
 * instead of one at a time. These are independent HTTP calls to Blob storage
 * (or the local-disk upload route in dev) with no shared server-side state,
 * so there's no reason item 2's upload should wait for item 1's to finish
 * before it even starts — unlike addDrink (phase 2, below), which stays
 * sequential because it's already serialized per-user by a Postgres advisory
 * lock (drinkEntryCommands.ts) regardless of how many requests arrive
 * concurrently. Returns a same-length, same-order array of settled results so
 * the caller can zip each one back to its entry.
 */
function uploadPhotos(
  entries: PendingCheckin[],
  userId: string,
  supportsDirectUpload: boolean
): Promise<PromiseSettledResult<ResolvedPhoto>[]> {
  return Promise.allSettled(
    entries.map(async (entry): Promise<ResolvedPhoto> => {
      if (entry.photo.kind === "uploaded") return { url: entry.photo.url, lqip: entry.photo.lqip };
      if (entry.photo.kind === "none") return { url: null, lqip: null };

      const file = new File([new Blob([entry.photo.arrayBuffer], { type: entry.photo.type })], entry.photo.name, {
        type: entry.photo.type,
      });
      const uploaded = await withTimeout(
        PhotoUploader.upload(file, drinkPhotoUploadEndpoints(userId, supportsDirectUpload)),
        SYNC_STEP_TIMEOUT_MS
      );
      if ("error" in uploaded) throw new PhotoUploadRejectedError(uploaded.error, uploaded.retryable ?? true);

      // Persist the blob's URL into the queue record right away — if
      // addDrink below throws or errors, a retry (automatic, or the panel's
      // "Retry now") must reuse this upload instead of uploading a fresh one
      // every attempt, which would otherwise orphan one blob per retry. This
      // also lets the panel's cancel() delete it (it only knows how to for
      // `kind: "uploaded"`).
      await updatePendingCheckin(entry.id, { photo: { kind: "uploaded", url: uploaded.url, lqip: uploaded.lqip } });
      return { url: uploaded.url, lqip: uploaded.lqip };
    })
  );
}

/**
 * The one flush implementation — every check-in is queued first
 * (log-drink-form.tsx) and reaches the server only through here, whether
 * that happens near-instantly (fired right after queueing, on a fast
 * connection) or much later (the auto-sync component recovering something
 * left over from a slow/dropped connection or a closed tab). Shared by that
 * immediate post-submit call, the auto-sync-on-reconnect component, and the
 * pending panel's manual "Retry now" button.
 *
 * Two phases, not one combined pass: photo uploads for every queued entry
 * run concurrently first (uploadPhotos, above), then addDrink calls run one
 * at a time in original order. Parallelizing the addDrink leg too wouldn't
 * actually save wall-clock time — they're already serialized server-side by
 * a per-user advisory lock — so this only pipelines the part that's genuinely
 * independent (network round trips to storage), while keeping the DB-writing
 * calls' ordering, and their per-entry error handling below, unchanged from
 * a plain sequential loop.
 *
 * A thrown error (fetch/network failure) means this entry couldn't reach the
 * server — it goes back to "queued" for a later retry, but the pass moves on
 * to the next entry rather than assuming the whole device is offline: a
 * genuinely offline device will just have every remaining entry throw the
 * same way and get requeued too, at no extra cost, while a one-off/transient
 * failure on a single item no longer stalls everything behind it until the
 * next trigger. A `{ error }` *result* means the server actually responded
 * and said no — that's marked "failed" so it stops auto-retrying, but the
 * pass continues to the next entry either way.
 *
 * `silent` suppresses the "Check-in synced" toast — pass it for the
 * immediate post-submit call, where the form already showed its own
 * "Logged" toast the instant it was queued; the auto-sync/retry callers
 * leave it on, since that's the only confirmation the user gets that
 * something recovered from being stuck.
 */
export async function flushPendingCheckins(
  userId: string,
  supportsDirectUpload: boolean,
  options: { silent?: boolean } = {}
): Promise<void> {
  if (flushing) return;
  flushing = true;

  try {
    const allEntries = await getAllPendingCheckins();
    const entries = allEntries.filter((entry) => entry.status !== "failed");
    if (entries.length === 0) return;

    await Promise.all(entries.map((entry) => updatePendingCheckin(entry.id, { status: "syncing" })));
    const photoResults = await uploadPhotos(entries, userId, supportsDirectUpload);

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const photoResult = photoResults[i];

      if (photoResult.status === "rejected") {
        const err = photoResult.reason;
        // Three distinct cases: a timeout means the upload was genuinely in
        // flight for the full window (retrying immediately would likely
        // just hang again); a non-retryable rejection means the server
        // already gave a definitive "no" to this exact file (wrong
        // format, too large) that retrying won't change; anything else
        // (a plain thrown network error, or a retryable rejection) is
        // requeued so the next trigger can retry it.
        if (err instanceof SyncTimeoutError) {
          await updatePendingCheckin(entry.id, { status: "failed", lastError: err.message });
        } else if (err instanceof PhotoUploadRejectedError && !err.retryable) {
          await updatePendingCheckin(entry.id, { status: "failed", lastError: err.message });
        } else {
          await updatePendingCheckin(entry.id, { status: "queued" });
        }
        continue;
      }

      try {
        const { url: photoUrl, lqip: photoLqip } = photoResult.value;
        const result = await withTimeout(
          addDrink({ ...entry.payload, photoUrl, photoLqip, createdAt: entry.createdAt }),
          SYNC_STEP_TIMEOUT_MS
        );
        if (result.error) {
          await updatePendingCheckin(entry.id, { status: "failed", lastError: result.error });
          continue;
        }

        await removePendingCheckin(entry.id);
        if (result.achievementUnlocked) triggerConfetti();
        if (!options.silent) showToast("Check-in synced");
      } catch (err) {
        // A timeout is distinct from an immediate failure (e.g. genuinely
        // offline): it means the request was actually in flight for the full
        // timeout window, not instantly rejected, so retrying the very next
        // trigger event would likely just hang again. Surface it as a
        // "failed" entry with Retry/Cancel instead of silently requeuing it
        // into another unattended hang, and let the pass continue to other
        // entries rather than stopping the whole batch on one stuck upload.
        if (err instanceof SyncTimeoutError) {
          await updatePendingCheckin(entry.id, { status: "failed", lastError: err.message });
          continue;
        }
        // Not a timeout — a genuine throw (fetch/network failure). Requeue
        // this entry and keep going: if the device is truly offline, the
        // remaining entries will throw the same way and get requeued too, no
        // worse off than stopping early; but if this was a one-off failure
        // on just this entry, the rest of the batch still gets a chance to
        // sync in this same pass instead of waiting for the next trigger.
        await updatePendingCheckin(entry.id, { status: "queued" });
        continue;
      }
    }
  } finally {
    flushing = false;
  }
}
