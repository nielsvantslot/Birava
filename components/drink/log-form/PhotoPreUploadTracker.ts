import { PhotoUploader } from "@/modules/photo-upload/client";
import type { PhotoUploadResultDto } from "@/modules/photo-upload/client";

type PendingUpload = {
  file: File;
  promise: Promise<PhotoUploadResultDto>;
  controller: AbortController;
  /** Filled in once the promise settles, so the create path can check synchronously whether it's ready to use. */
  result: PhotoUploadResultDto | null;
};

type UploadEndpoints = Parameters<typeof PhotoUploader.upload>[1];

/**
 * Tracks a photo upload kicked off the moment it was picked, so submit can
 * reuse it instead of starting a fresh one — most of the time it's already
 * resolved by the time the user finishes typing the drink name/venue and hits
 * submit. Holds at most one upload; starting another discards the previous.
 */
export class PhotoPreUploadTracker {
  private pending: PendingUpload | null = null;

  /**
   * Starts uploading `file` silently in the background. Submit falls back to
   * a fresh attempt if this didn't pan out, so there's nothing the user needs
   * to see happen here.
   */
  start(file: File, endpoints: UploadEndpoints): void {
    const controller = new AbortController();
    const promise = PhotoUploader.upload(file, endpoints, controller.signal);
    const entry: PendingUpload = { file, promise, controller, result: null };
    this.pending = entry;
    promise.then((result) => {
      if (this.pending === entry) entry.result = result;
    });
  }

  /**
   * Aborts whatever pre-upload is in flight. `deleteIfAlreadyUploaded`
   * controls what happens if the abort lost the race and the upload had
   * already finished: true cleans up the now-orphaned blob (the user is
   * discarding this photo entirely, or submit ended up not using it), false
   * just stops tracking it without touching storage (the URL is about to be
   * legitimately used).
   */
  discard(deleteIfAlreadyUploaded: boolean): void {
    const previous = this.pending;
    this.pending = null;
    if (!previous) return;

    previous.controller.abort();
    if (!deleteIfAlreadyUploaded) return;
    previous.promise.then((result) => {
      if ("url" in result) {
        // keepalive lets this survive a tab close/navigation that would
        // otherwise cancel a plain fetch mid-flight — still no guarantee (the
        // browser can drop it regardless), which is why
        // photoCleanupCommands.ts's scheduled sweep exists as the real
        // backstop; this just makes the fast path more often unnecessary.
        fetch("/api/uploads/drink-photo", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: result.url }),
          keepalive: true,
        }).catch(() => {});
      }
    });
  }

  /** Edit path: waits for the pre-upload of `file` (or starts a fresh upload) and consumes it. */
  async resultForEdit(file: File, endpoints: UploadEndpoints): Promise<PhotoUploadResultDto> {
    const pending = this.pending;
    const usingPending = pending !== null && pending.file === file;
    const uploadResult = usingPending ? await pending.promise : await PhotoUploader.upload(file, endpoints);
    if (usingPending) this.discard(false); // consumed — don't delete it
    return uploadResult;
  }

  /**
   * Create path: the pre-upload's result, only if it already resolved —
   * checked synchronously (no awaiting) so a slow/incomplete pre-upload can
   * never hold up queueing.
   */
  readyResultFor(file: File): PhotoUploadResultDto | null {
    return this.pending?.file === file ? this.pending.result : null;
  }
}
