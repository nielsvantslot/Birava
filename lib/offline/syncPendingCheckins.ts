import { PhotoUploader } from "@/modules/photo-upload/client";
import { drinkPhotoUploadEndpoints } from "@/lib/photoUploadConfig";
import { addDrink } from "@/lib/controllers/drinkController";
import { showToast } from "@/components/ui/toast-pill";
import { getAllPendingCheckins, removePendingCheckin, updatePendingCheckin } from "@/lib/offline/pendingCheckins";

let flushing = false;

/**
 * The one flush implementation, shared by the auto-sync-on-reconnect
 * component and the pending panel's manual "Retry now" button.
 *
 * A thrown error (fetch/network failure) means we're still offline — the
 * entry goes back to "queued" and the pass stops there, leaving the rest
 * queued for the next trigger. A `{ error }` *result* means the server
 * actually responded and said no — that's marked "failed" so it stops
 * auto-retrying, but the pass continues to the next entry.
 */
export async function flushPendingCheckins(userId: string, supportsDirectUpload: boolean): Promise<void> {
  if (flushing) return;
  flushing = true;

  try {
    const entries = await getAllPendingCheckins();
    for (const entry of entries) {
      if (entry.status === "failed") continue;

      await updatePendingCheckin(entry.id, { status: "syncing" });
      try {
        let photoUrl: string | null = null;
        let photoLqip: string | null = null;

        if (entry.photo.kind === "uploaded") {
          photoUrl = entry.photo.url;
          photoLqip = entry.photo.lqip;
        } else if (entry.photo.kind === "raw") {
          const file = new File([new Blob([entry.photo.arrayBuffer], { type: entry.photo.type })], entry.photo.name, {
            type: entry.photo.type,
          });
          const uploaded = await PhotoUploader.upload(file, drinkPhotoUploadEndpoints(userId, supportsDirectUpload));
          if ("error" in uploaded) throw new Error(uploaded.error);
          photoUrl = uploaded.url;
          photoLqip = uploaded.lqip;
        }

        const result = await addDrink({ ...entry.payload, photoUrl, photoLqip });
        if (result.error) {
          await updatePendingCheckin(entry.id, { status: "failed", lastError: result.error });
          continue;
        }

        await removePendingCheckin(entry.id);
        showToast("Check-in synced");
      } catch {
        await updatePendingCheckin(entry.id, { status: "queued" });
        break;
      }
    }
  } finally {
    flushing = false;
  }
}
