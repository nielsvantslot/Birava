import { ErrorEnvelope } from "@/lib/gateway/ErrorEnvelope";
import { showToast } from "@/components/ui/toast-pill";
import { triggerConfetti } from "@/modules/achievements/domain/achievements";
import { drinkPhotoUploadEndpoints } from "@/modules/media/domain/photoUploadConfig";
import { addDrink } from "@/modules/checkins/actions/drinkController";
import type { ICheckinSender, CheckinSendRequest, CheckinSendResult } from "@/modules/checkins/domain/outbox/ICheckinSender";
import type { IOutboxNotifier } from "@/modules/checkins/domain/outbox/IOutboxNotifier";
import type { IOutboxPhotoUploader, OutboxPhotoUpload } from "@/modules/checkins/domain/outbox/IOutboxPhotoUploader";
import type { IOutboxStorage } from "@/modules/checkins/domain/outbox/IOutboxStorage";
import { PhotoUploader } from "@/modules/photo-upload/client";
import { addPendingCheckin, getAllPendingCheckins, removePendingCheckin, updatePendingCheckin } from "./pendingCheckins";

// The web implementations of the outbox's ports. A native client writes its
// own (SQLite or MMKV storage, the HTTP API as the sender) and reuses the
// flusher in domain/outbox unchanged.

/** The queue in the browser's IndexedDB (see pendingCheckins.ts). */
export class IndexedDbOutboxStorage implements IOutboxStorage {
  getAll(userId: string) {
    return getAllPendingCheckins(userId);
  }

  add(entry: Parameters<IOutboxStorage["add"]>[0]) {
    return addPendingCheckin(entry);
  }

  update(id: string, patch: Parameters<IOutboxStorage["update"]>[1]) {
    return updatePendingCheckin(id, patch);
  }

  remove(id: string) {
    return removePendingCheckin(id);
  }
}

/** Uploads a queued raw photo with the browser upload client (direct to storage in production, through the server in dev). */
export class BrowserPhotoUploader implements IOutboxPhotoUploader {
  constructor(private readonly supportsDirectUpload: boolean) {}

  async uploadRaw(photo: { arrayBuffer: ArrayBuffer; type: string; name: string }, userId: string): Promise<OutboxPhotoUpload> {
    const file = new File([new Blob([photo.arrayBuffer], { type: photo.type })], photo.name, { type: photo.type });
    return PhotoUploader.upload(file, drinkPhotoUploadEndpoints(userId, this.supportsDirectUpload));
  }
}

/** Sends a check-in through the addDrink server action. */
export class AddDrinkCheckinSender implements ICheckinSender {
  async send(request: CheckinSendRequest): Promise<CheckinSendResult> {
    const result = await addDrink(request);
    if (result.error) return { ok: false, error: result.error, transient: ErrorEnvelope.isTransient(result) };
    return { ok: true, achievementUnlocked: !!result.achievementUnlocked };
  }
}

export class ToastOutboxNotifier implements IOutboxNotifier {
  synced(): void {
    showToast("Check-in synced");
  }

  achievementUnlocked(): void {
    triggerConfetti();
  }
}
