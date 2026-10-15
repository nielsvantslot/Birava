import type { ICheckinSender } from "./ICheckinSender";
import type { IOutboxNotifier } from "./IOutboxNotifier";
import type { IOutboxPhotoUploader } from "./IOutboxPhotoUploader";
import type { IOutboxStorage } from "./IOutboxStorage";
import type { PendingCheckin } from "./PendingCheckin";

// Neither a photo upload nor the check-in send carry their own timeout — a
// genuinely hung network request (a stalled connection to Blob storage, an
// unresponsive function) previously left an entry stuck at "syncing" forever,
// with no escape: the Cancel button is deliberately hidden while "syncing"
// (see PendingCheckinsPanel), and nothing else ever revisits an entry already
// marked "syncing". Racing each step against this bounds the wait and hands
// control back to the user (via the "failed" status's Retry/Cancel buttons)
// instead of an unrecoverable hang. The underlying operation isn't actually
// cancelled — it may still complete in the background, its result just
// discarded — but the user is never stuck again.
export const SYNC_STEP_TIMEOUT_MS = 45_000;

class SyncTimeoutError extends Error {}

/**
 * Wraps a *completed* photo-upload rejection, carrying its `retryable` flag
 * through Promise.allSettled — a plain `throw new Error(...)` lost that
 * distinction entirely, so a deterministic rejection (unsupported format,
 * oversized file) and a transient one (network drop) were handled
 * identically: both got silently requeued as "queued" forever. A
 * permanently-broken photo would cycle queued, syncing, queued indefinitely,
 * always blamed on "waiting for connection" though connectivity was never the
 * problem.
 */
class PhotoUploadRejectedError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean
  ) {
    super(message);
  }
}

type ResolvedPhoto = { url: string | null; lqip: string | null };

/**
 * The offline outbox's flush: queued check-ins in, saved check-ins out. It
 * holds all the logic (two phases, per-entry outcomes, timeouts, coalescing)
 * and none of the platform: storage, photo upload, sending and notifying are
 * injected, so the same flusher runs in the browser (IndexedDB, the
 * addDrink action) and, later, in a React Native client (SQLite, the HTTP
 * API). It uses nothing but Promises and timers.
 */
export class OutboxFlusher {
  private flushing = false;
  private rerunRequested = false;

  constructor(
    private readonly storage: IOutboxStorage,
    private readonly photos: IOutboxPhotoUploader,
    private readonly sender: ICheckinSender,
    private readonly notifier: IOutboxNotifier,
    private readonly stepTimeoutMs = SYNC_STEP_TIMEOUT_MS
  ) {}

  /**
   * The one flush implementation — every check-in is queued first and reaches
   * the server only through here, whether that happens near-instantly (fired
   * right after queueing, on a fast connection) or much later (recovering
   * something left over from a slow/dropped connection or a closed app).
   *
   * Coalesces overlapping calls instead of just deduping them: a call that
   * arrives while a pass is already running doesn't get to see whatever
   * changed since that pass took its queue snapshot (a check-in queued
   * mid-pass, a manual retry flipping a failed entry back to "queued"), so
   * dropping it outright would strand that change until the next external
   * trigger — on an otherwise-healthy connection, that reads as a check-in
   * stuck in "Queued" for no reason. `rerunRequested` makes the in-flight call
   * run one more full pass immediately after it finishes instead, so
   * overlapping calls still never run concurrently but their work never just
   * gets lost either.
   */
  async flush(userId: string, options: { silent?: boolean } = {}): Promise<void> {
    if (this.flushing) {
      this.rerunRequested = true;
      return;
    }
    this.flushing = true;

    try {
      do {
        this.rerunRequested = false;
        await this.runOnePass(userId, options);
      } while (this.rerunRequested);
    } finally {
      this.flushing = false;
    }
  }

  /**
   * One pass over the current queue snapshot.
   *
   * Two phases, not one combined loop: photo uploads for every queued entry
   * run concurrently first, then check-in sends run one at a time in original
   * order. Parallelizing the sends too wouldn't actually save wall-clock time
   * — they're already serialized server-side by a per-user lock — so this only
   * pipelines the part that's genuinely independent (network round trips to
   * storage), while keeping the DB-writing calls' ordering, and their
   * per-entry error handling below, unchanged from a plain sequential loop.
   *
   * A thrown error (network failure) means this entry couldn't reach the
   * server — it goes back to "queued" for a later retry, but the pass moves on
   * to the next entry rather than assuming the whole device is offline: a
   * genuinely offline device will just have every remaining entry throw the
   * same way and get requeued too, at no extra cost, while a one-off/transient
   * failure on a single item no longer stalls everything behind it. A
   * definitive "no" from the server marks the entry "failed" so it stops
   * auto-retrying, but the pass continues to the next entry either way.
   *
   * `silent` suppresses the "synced" notice — pass it for the immediate
   * post-submit call, where the form already showed its own "Logged" notice the
   * instant it was queued; the auto-sync/retry callers leave it on, since
   * that's the only confirmation the user gets that something recovered.
   */
  private async runOnePass(userId: string, options: { silent?: boolean }): Promise<void> {
    const allEntries = await this.storage.getAll(userId);
    const entries = allEntries.filter((entry) => entry.status !== "failed");
    if (entries.length === 0) return;

    await Promise.all(entries.map((entry) => this.storage.update(entry.id, { status: "syncing" })));
    const photoResults = await this.uploadPhotos(entries, userId);

    for (let i = 0; i < entries.length; i++) {
      // photoResults is index-aligned with entries (uploadPhotos maps 1:1).
      const entry = entries[i]!;
      const photoResult = photoResults[i]!;

      if (photoResult.status === "rejected") {
        const err = photoResult.reason;
        // Three distinct cases: a timeout means the upload was genuinely in
        // flight for the full window (retrying immediately would likely just
        // hang again); a non-retryable rejection means the server already gave
        // a definitive "no" to this exact file (wrong format, too large) that
        // retrying won't change; anything else (a plain thrown network error,
        // or a retryable rejection) is requeued so the next trigger can retry.
        if (err instanceof SyncTimeoutError) {
          await this.storage.update(entry.id, { status: "failed", lastError: err.message });
        } else if (err instanceof PhotoUploadRejectedError && !err.retryable) {
          await this.storage.update(entry.id, { status: "failed", lastError: err.message });
        } else {
          await this.storage.update(entry.id, { status: "queued" });
        }
        continue;
      }

      await this.sendOne(entry, photoResult.value, options);
    }
  }

  private async sendOne(entry: PendingCheckin, photo: ResolvedPhoto, options: { silent?: boolean }): Promise<void> {
    try {
      const result = await this.withTimeout(
        this.sender.send({ ...entry.payload, photoUrl: photo.url, photoLqip: photo.lqip, createdAt: entry.createdAt, clientId: entry.id })
      );
      if (!result.ok) {
        // The limiter or an upstream service said "not now", not "no": keep it queued for the next trigger.
        await this.storage.update(entry.id, { status: result.transient ? "queued" : "failed", lastError: result.error });
        return;
      }

      await this.storage.remove(entry.id);
      if (result.achievementUnlocked) this.notifier.achievementUnlocked();
      if (!options.silent) this.notifier.synced();
    } catch (err) {
      // A timeout is distinct from an immediate failure (e.g. genuinely
      // offline): it means the request was actually in flight for the full
      // timeout window, not instantly rejected, so retrying the very next
      // trigger event would likely just hang again. Surface it as a "failed"
      // entry with Retry/Cancel instead of silently requeuing it into another
      // unattended hang, and let the pass continue to other entries rather
      // than stopping the whole batch on one stuck upload.
      if (err instanceof SyncTimeoutError) {
        await this.storage.update(entry.id, { status: "failed", lastError: err.message });
        return;
      }
      // Not a timeout — a genuine throw (network failure). Requeue this entry
      // and keep going: if the device is truly offline, the remaining entries
      // will throw the same way and get requeued too, no worse off than
      // stopping early; but if this was a one-off failure on just this entry,
      // the rest of the batch still gets a chance to sync in this same pass
      // instead of waiting for the next trigger.
      await this.storage.update(entry.id, { status: "queued" });
    }
  }

  /**
   * Phase 1 of a flush: every entry's photo upload, kicked off concurrently
   * instead of one at a time. These are independent HTTP calls to storage with
   * no shared server-side state, so there's no reason item 2's upload should
   * wait for item 1's to finish before it even starts — unlike the send (phase
   * 2), which stays sequential because it's already serialized per user on the
   * server. Returns a same-length, same-order array of settled results so the
   * caller can zip each one back to its entry.
   */
  private uploadPhotos(entries: PendingCheckin[], userId: string): Promise<PromiseSettledResult<ResolvedPhoto>[]> {
    return Promise.allSettled(
      entries.map(async (entry): Promise<ResolvedPhoto> => {
        if (entry.photo.kind === "uploaded") return { url: entry.photo.url, lqip: entry.photo.lqip };
        if (entry.photo.kind === "none") return { url: null, lqip: null };

        const uploaded = await this.withTimeout(this.photos.uploadRaw(entry.photo, userId));
        if ("error" in uploaded) throw new PhotoUploadRejectedError(uploaded.error, uploaded.retryable ?? true);

        // Persist the blob's URL into the queue record right away — if the send
        // below throws or errors, a retry (automatic, or the panel's "Retry
        // now") must reuse this upload instead of uploading a fresh one every
        // attempt, which would otherwise orphan one blob per retry. This also
        // lets the panel's cancel() delete it (it only knows how to for
        // `kind: "uploaded"`).
        await this.storage.update(entry.id, { photo: { kind: "uploaded", url: uploaded.url, lqip: uploaded.lqip } });
        return { url: uploaded.url, lqip: uploaded.lqip };
      })
    );
  }

  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new SyncTimeoutError("Sync timed out — check your connection and try again.")), this.stepTimeoutMs);
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
}
