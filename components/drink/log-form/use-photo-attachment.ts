"use client";

import { useEffect, useRef, useState } from "react";
import { PhotoUploadPreparer, PhotoMetadataStripFailedError } from "@/modules/photo-upload/client";
import type { PhotoUploadResultDto } from "@/modules/photo-upload/client";
import { showToast } from "@/components/ui/toast-pill";
import { DRINK_PHOTO_MAX_DIMENSION, DRINK_PHOTO_MAX_UPLOAD_BYTES, drinkPhotoUploadEndpoints } from "@/modules/media/domain/photoUploadConfig";
import type { PendingCheckinPhoto } from "@/modules/checkins/client/pendingCheckins";
import { PhotoPreUploadTracker } from "./PhotoPreUploadTracker";

// JPEG canvas-encode quality (0-1) is a client-only concern — the server's
// WebP quality (0-100, modules/media/server/photoUpload.ts) is a different encoder/scale, not
// the same number, so it isn't shared here.
const PHOTO_COMPRESS_CONFIG = { maxDimension: DRINK_PHOTO_MAX_DIMENSION, quality: 0.85 };

/**
 * Everything photo-related in the check-in form: the picked file and preview,
 * the background pre-upload (see PhotoPreUploadTracker), its cleanup, and how
 * each submit path consumes it. `initialPreview` is the stored photo's display
 * URL when editing — photos are displayed through /api/photos/[entryId]; the
 * raw photo_url is a storage handle, never an <img> src.
 */
export function usePhotoAttachment({
  userId,
  supportsDirectUpload,
  initialPreview,
}: {
  userId: string;
  supportsDirectUpload: boolean;
  initialPreview: string | null;
}) {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(initialPreview);
  const [tracker] = useState(() => new PhotoPreUploadTracker());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endpoints = () => drinkPhotoUploadEndpoints(userId, supportsDirectUpload);

  // Revokes the outgoing blob URL whenever a new photo replaces it and on
  // unmount — createObjectURL memory is otherwise held until the tab closes.
  // A no-op for the initial edit-mode value (drinkPhotoSrc(...) isn't a blob:
  // URL).
  useEffect(() => {
    return () => {
      if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  // Two layered "the user is leaving" signals, covering what
  // tracker.discard's other call sites don't:
  // - unmount: in-app navigation away from this form (back button, a nav
  //   link, closing an edit modal) while the tab stays open.
  // - pagehide, when not `persisted`: the tab/app is actually closing, not
  //   just being frozen into the back/forward cache — a `persisted` pagehide
  //   can still come back verbatim via bfcache restore, and deleting the
  //   blob there would leave the tracker pointing at a URL the server
  //   just 404s, so it's deliberately skipped.
  // Neither runs if the OS kills a backgrounded mobile app outright — no JS
  // executes at all when that happens, so nothing client-side can catch it.
  // photoCleanupCommands.ts's daily sweep is the real backstop for that case
  // (and for any of these best-effort sends that just don't land).
  useEffect(() => {
    const onPageHide = (e: PageTransitionEvent) => {
      if (!e.persisted) tracker.discard(true);
    };
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      tracker.discard(true);
    };
  }, [tracker]);

  const resetFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    tracker.discard(true);

    let prepared: File, previewUrl: string | null;
    try {
      ({ file: prepared, previewUrl } = await PhotoUploadPreparer.prepare(file, PHOTO_COMPRESS_CONFIG, supportsDirectUpload));
    } catch (err) {
      showToast(err instanceof PhotoMetadataStripFailedError ? err.message : "Couldn't process this photo. Try a different one.");
      resetFileInput();
      return;
    }
    // Checked here, the moment the photo is picked, rather than at submit —
    // client-side compression usually keeps this from ever firing, but when
    // it does, the user should hear about it before filling in the rest of
    // the form, not after.
    if (prepared.size > DRINK_PHOTO_MAX_UPLOAD_BYTES) {
      showToast("Photo is too large. Please use a smaller photo.");
      resetFileInput();
      return;
    }
    setPhotoFile(prepared);
    setPhotoPreview(previewUrl);

    // Most users submit with the exact photo they just picked — start the
    // upload now instead of waiting for submit, so it's usually already done
    // by the time they finish the rest of the form.
    tracker.start(prepared, endpoints());
  };

  const clearPhotoUi = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    resetFileInput();
  };

  const handleRemovePhoto = () => {
    tracker.discard(true);
    clearPhotoUi();
  };

  /** Edit path: waits for the pre-upload (or starts a fresh one) and hands back its result. */
  const uploadForEdit = (file: File): Promise<PhotoUploadResultDto> => tracker.resultForEdit(file, endpoints());

  /** Create path: what the offline queue should store for the picked photo. */
  const photoForQueue = async (file: File | null): Promise<PendingCheckinPhoto> => {
    if (!file) return { kind: "none" };
    // Use the pre-upload only if it actually already resolved successfully.
    // Anything else (still in flight, or it resolved with an error) falls
    // back to the raw bytes, which flushPendingCheckins will upload fresh
    // when it syncs this entry.
    const cached = tracker.readyResultFor(file);
    if (cached && !("error" in cached)) {
      tracker.discard(false); // consumed — don't delete it
      return { kind: "uploaded", url: cached.url, lqip: cached.lqip };
    }
    const photo: PendingCheckinPhoto = {
      kind: "raw",
      arrayBuffer: await file.arrayBuffer(),
      type: file.type || "image/jpeg",
      name: file.name,
    };
    // Not consumed — if the pre-upload finishes later anyway, it's an
    // orphan the moment it resolves with a URL.
    tracker.discard(true);
    return photo;
  };

  return {
    photoFile,
    photoPreview,
    fileInputRef,
    handlePhotoChange,
    handleRemovePhoto,
    clearPhotoUi,
    uploadForEdit,
    photoForQueue,
  };
}
