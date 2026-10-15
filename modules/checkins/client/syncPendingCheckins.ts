import { OutboxFlusher } from "@/modules/checkins/domain/outbox/OutboxFlusher";
import { AddDrinkCheckinSender, BrowserPhotoUploader, IndexedDbOutboxStorage, ToastOutboxNotifier } from "./OutboxAdapters";

// One flusher per upload mode, kept for the life of the page: its coalescing
// state (a flush already running) is what stops overlapping triggers (the
// post-submit call, reconnect, tab focus, the pending panel's retry) from
// running concurrent passes. All the logic lives in domain/outbox/OutboxFlusher.
const flushers = new Map<boolean, OutboxFlusher>();

function flusherFor(supportsDirectUpload: boolean): OutboxFlusher {
  let flusher = flushers.get(supportsDirectUpload);
  if (!flusher) {
    flusher = new OutboxFlusher(
      new IndexedDbOutboxStorage(),
      new BrowserPhotoUploader(supportsDirectUpload),
      new AddDrinkCheckinSender(),
      new ToastOutboxNotifier()
    );
    flushers.set(supportsDirectUpload, flusher);
  }
  return flusher;
}

/**
 * Sends every queued check-in for `userId` (see OutboxFlusher.flush). Shared by
 * the immediate post-submit call, the auto-sync-on-reconnect component, and
 * the pending panel's manual "Retry now" button.
 */
export async function flushPendingCheckins(
  userId: string,
  supportsDirectUpload: boolean,
  options: { silent?: boolean } = {}
): Promise<void> {
  return flusherFor(supportsDirectUpload).flush(userId, options);
}
