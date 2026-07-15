import { PhotoUploader } from "@/modules/photo-upload/client";
import { drinkPhotoUploadEndpoints } from "@/lib/photoUploadConfig";
import { addDrink } from "@/lib/controllers/drinkController";
import { triggerConfetti } from "@/lib/achievements";
import { showToast } from "@/components/ui/toast-pill";
import { getAllPendingCheckins, removePendingCheckin, updatePendingCheckin } from "@/lib/offline/pendingCheckins";

let flushing = false;

/**
 * The one flush implementation — every check-in is queued first
 * (log-drink-form.tsx) and reaches the server only through here, whether
 * that happens near-instantly (fired right after queueing, on a fast
 * connection) or much later (the auto-sync component recovering something
 * left over from a slow/dropped connection or a closed tab). Shared by that
 * immediate post-submit call, the auto-sync-on-reconnect component, and the
 * pending panel's manual "Retry now" button.
 *
 * A thrown error (fetch/network failure) means we're still offline — the
 * entry goes back to "queued" and the pass stops there, leaving the rest
 * queued for the next trigger. A `{ error }` *result* means the server
 * actually responded and said no — that's marked "failed" so it stops
 * auto-retrying, but the pass continues to the next entry.
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

        const result = await addDrink({ ...entry.payload, photoUrl, photoLqip, createdAt: entry.createdAt });
        if (result.error) {
          await updatePendingCheckin(entry.id, { status: "failed", lastError: result.error });
          continue;
        }

        await removePendingCheckin(entry.id);
        if (result.achievementUnlocked) triggerConfetti();
        if (!options.silent) showToast("Check-in synced");
      } catch {
        await updatePendingCheckin(entry.id, { status: "queued" });
        break;
      }
    }
  } finally {
    flushing = false;
  }
}
