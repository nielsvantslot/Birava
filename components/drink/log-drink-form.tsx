"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PhotoUploadPreparer, PhotoUploader } from "@/modules/photo-upload/client";
import type { PhotoUploadResultDto } from "@/modules/photo-upload/client";
import {
  addDrink,
  editDrink,
  deleteDrink,
} from "@/lib/controllers/drinkController";
import { triggerConfetti } from "@/lib/achievements";
import { showToast } from "@/components/ui/toast-pill";
import { DrinkEntry, DRINK_TYPES } from "@/lib/types";
import { drinkPhotoSrc, cn } from "@/lib/utils";
import { DRINK_PHOTO_MAX_DIMENSION, DRINK_PHOTO_MAX_UPLOAD_BYTES, drinkPhotoUploadEndpoints } from "@/lib/photoUploadConfig";
import { addPendingCheckin } from "@/lib/offline/pendingCheckins";
import type { PendingCheckinPhoto } from "@/lib/offline/pendingCheckins";

type Coords = { lat: number; lng: number };

function getPosition(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        }),
      reject,
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}

// JPEG canvas-encode quality (0-1) is a client-only concern — the server's
// WebP quality (0-100, lib/photoUpload.ts) is a different encoder/scale, not
// the same number, so it isn't shared here.
const PHOTO_COMPRESS_CONFIG = { maxDimension: DRINK_PHOTO_MAX_DIMENSION, quality: 0.85 };

function isOffline(): boolean {
  return typeof navigator !== "undefined" && "onLine" in navigator && !navigator.onLine;
}

async function reverseGeocode(coords: Coords): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lng}&zoom=18`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return (
      data.name ||
      data.address?.amenity ||
      data.address?.tourism ||
      data.address?.building ||
      data.address?.road ||
      null
    );
  } catch {
    return null;
  }
}

/**
 * The one log form — used for both creating and editing a check-in.
 * Deliberately small: name, type, optional photo, venue. Geolocation
 * prefills the venue silently and never blocks logging.
 */
export function CheckinForm({
  editEntry,
  userId,
  supportsDirectUpload,
}: {
  editEntry?: DrinkEntry;
  userId: string;
  supportsDirectUpload: boolean;
}) {
  const router = useRouter();
  const editing = !!editEntry;
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(editEntry?.drink_name ?? "");
  const [type, setType] = useState<string>(
    editEntry?.drink_type ?? DRINK_TYPES[0]
  );
  const [venue, setVenue] = useState(editEntry?.venue ?? "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  // Photos are displayed through /api/photos/[entryId]; the raw
  // photo_url is a storage handle, never an <img> src.
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    editEntry?.photo_url ? drinkPhotoSrc(editEntry.id) : null
  );
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<Coords | null>(
    editEntry?.lat != null && editEntry?.lng != null
      ? { lat: editEntry.lat, lng: editEntry.lng }
      : null
  );
  const [locating, setLocating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Tracks a photo upload kicked off the moment it was picked (see
  // handlePhotoChange), so handleSubmit can reuse it instead of starting a
  // fresh one — most of the time it's already resolved by the time the user
  // finishes typing the drink name/venue and hits submit.
  const pendingUploadRef = useRef<{ file: File; promise: Promise<PhotoUploadResultDto>; controller: AbortController } | null>(null);

  const captureLocation = async (announce: boolean) => {
    setLocating(true);
    try {
      const position = await getPosition();
      setCoords(position);
      const suggestion = await reverseGeocode(position);
      // Only prefill the venue if the user hasn't typed one meanwhile
      if (suggestion) setVenue((v) => (v.trim() ? v : suggestion));
      if (announce) showToast("Location attached");
    } catch {
      if (announce) showToast("Couldn't get your location");
    } finally {
      setLocating(false);
    }
  };

  // Capture silently when the user has already granted geolocation
  useEffect(() => {
    if (editing) return;
    if (!("geolocation" in navigator) || !navigator.permissions?.query) return;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((status) => {
        if (status.state === "granted") captureLocation(false);
      })
      .catch(() => {});
  }, [editing]);

  // Aborts whatever pre-upload is in flight (see handlePhotoChange).
  // `deleteIfAlreadyUploaded` controls what happens if the abort lost the
  // race and the upload had already finished: true cleans up the now-orphaned
  // blob (the user is discarding this photo entirely — replacing or removing
  // it), false just stops tracking it without touching storage (the URL is
  // about to be legitimately used — see resetFormAfterSubmit).
  const discardPendingUpload = (deleteIfAlreadyUploaded: boolean) => {
    const previous = pendingUploadRef.current;
    pendingUploadRef.current = null;
    if (!previous) return;

    previous.controller.abort();
    if (!deleteIfAlreadyUploaded) return;
    previous.promise.then((result) => {
      if ("url" in result) {
        fetch("/api/uploads/drink-photo", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: result.url }),
        }).catch(() => {});
      }
    });
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    discardPendingUpload(true);

    const { file: prepared, previewUrl } = await PhotoUploadPreparer.prepare(file, PHOTO_COMPRESS_CONFIG, supportsDirectUpload);
    setPhotoFile(prepared);
    setPhotoPreview(previewUrl);

    // Most users submit with the exact photo they just picked — start the
    // upload silently in the background now instead of waiting for submit,
    // so it's usually already done by the time they finish the rest of the
    // form. handleSubmit falls back to a fresh attempt if this didn't pan
    // out, so there's nothing the user needs to see happen here.
    const controller = new AbortController();
    const promise = PhotoUploader.upload(prepared, drinkPhotoUploadEndpoints(userId, supportsDirectUpload), controller.signal);
    pendingUploadRef.current = { file: prepared, promise, controller };
  };

  const clearPhotoUi = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemovePhoto = () => {
    discardPendingUpload(true);
    clearPhotoUi();
  };

  const handleDelete = () => {
    if (!editEntry) return;
    startTransition(async () => {
      const result = await deleteDrink({ id: editEntry.id });
      if (result.error) {
        setError(result.error);
        return;
      }
      showToast("Check-in deleted");
      router.push("/log");
      router.refresh();
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        // Keep the existing storage handle when the photo is untouched;
        // clear it when the preview was removed.
        let photoUrl: string | null =
          !photoFile && photoPreview ? (editEntry?.photo_url ?? null) : null;
        let photoLqip: string | null =
          !photoFile && photoPreview ? (editEntry?.photo_lqip ?? null) : null;

        if (photoFile) {
          if (photoFile.size > DRINK_PHOTO_MAX_UPLOAD_BYTES) {
            setError("Photo is too large. Please use a smaller photo.");
            return;
          }

          // Editing always uploads normally — offline handling below is
          // create-only. Creating skips straight past a doomed request when
          // we already know we're offline, so the raw file goes to the queue
          // untouched instead of waiting out a network timeout first.
          if (editEntry || !isOffline()) {
            // Reuse the pre-upload only if it actually succeeded — a promise
            // that already resolved to {error} would just replay the same
            // cached failure instead of giving a fresh attempt a chance.
            const preUploaded =
              pendingUploadRef.current?.file === photoFile ? await pendingUploadRef.current.promise : null;
            const uploadResult =
              preUploaded && !("error" in preUploaded)
                ? preUploaded
                : await PhotoUploader.upload(photoFile, drinkPhotoUploadEndpoints(userId, supportsDirectUpload));

            if ("error" in uploadResult) {
              if (editEntry || !isOffline()) {
                setError(uploadResult.error);
                return;
              }
              // Went offline mid-upload — photoUrl/photoLqip stay null, and
              // the raw file carries through to the offline queue below.
            } else {
              photoUrl = uploadResult.url;
              photoLqip = uploadResult.lqip;
            }
          }
        }

        const payload = {
          drinkName: name.trim() || null,
          drinkType: type,
          venue: venue.trim() || null,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          notes: editEntry?.notes ?? null,
          photoUrl: photoUrl,
          photoLqip: photoLqip,
        };

        if (editEntry) {
          const result = await editDrink({ id: editEntry.id, ...payload });
          if (result.error) {
            setError(result.error);
            return;
          }
          showToast("Check-in updated");
          router.push(`/sessions/${editEntry.id}`);
          router.refresh();
          return;
        }

        if (!isOffline()) {
          try {
            const result = await addDrink(payload);
            if (result.error) {
              setError(result.error);
              return;
            }

            if (result.achievementUnlocked) triggerConfetti();
            showToast("Logged — added to tonight's session");
            resetFormAfterSubmit();
            router.push(`/sessions/${result.id}`);
            router.refresh();
            return;
          } catch {
            if (!isOffline()) {
              setError("Something went wrong. Please try again.");
              return;
            }
            // Went offline mid-submit — fall through to the offline queue.
          }
        }

        // Offline — either known upfront or discovered above. Queue
        // durably (IndexedDB survives closing/backgrounding the app) instead
        // of losing the check-in.
        const photoForQueue: PendingCheckinPhoto = photoUrl
          ? { kind: "uploaded", url: photoUrl, lqip: photoLqip }
          : photoFile
            ? { kind: "raw", arrayBuffer: await photoFile.arrayBuffer(), type: photoFile.type || "image/jpeg", name: photoFile.name }
            : { kind: "none" };

        await addPendingCheckin({
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          payload: {
            drinkName: payload.drinkName,
            drinkType: payload.drinkType,
            venue: payload.venue,
            lat: payload.lat,
            lng: payload.lng,
            notes: payload.notes,
          },
          photo: photoForQueue,
        });

        showToast("Saved — will sync when you're back online");
        resetFormAfterSubmit();
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  };

  function resetFormAfterSubmit() {
    setName("");
    setVenue("");
    // The photo (if any) was just legitimately consumed — saved to the new
    // check-in or carried into the offline queue — so only stop tracking the
    // pre-upload, don't delete it the way handleRemovePhoto would.
    discardPendingUpload(false);
    clearPhotoUi();
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="drink-name">Drink</label>
        <input
          id="drink-name"
          type="text"
          placeholder="Name or search…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="field">
        <label>Type</label>
        <div className="seg">
          {DRINK_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className={cn("chip", type === t && "on")}
              onClick={() => setType(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>
          Photo{" "}
          <span style={{ color: "var(--ink-dim)", fontWeight: 500 }}>
            · optional
          </span>
        </label>
        {photoPreview ? (
          <div style={{ position: "relative" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoPreview}
              alt="Check-in photo preview"
              style={{
                width: "100%",
                height: 190,
                objectFit: "cover",
                borderRadius: 14,
                display: "block",
              }}
            />
            <button
              type="button"
              className="chip"
              style={{ position: "absolute", top: 10, right: 10 }}
              onClick={handleRemovePhoto}
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              height: 190,
              background: "var(--surface-2)",
              border: "1.5px dashed var(--line)",
              borderRadius: 14,
              color: "var(--ink-dim)",
              font: "inherit",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 8h3l2-3h6l2 3h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"></path>
              <circle cx="12" cy="13" r="3.5"></circle>
            </svg>
            Add a photo
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhotoChange}
        />
      </div>

      <div className="field">
        <label htmlFor="venue">Venue</label>
        <input
          id="venue"
          type="text"
          placeholder="Where are you drinking?"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
        />
        <div
          style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}
        >
          <button
            type="button"
            className={cn("chip", coords && "on")}
            disabled={locating}
            onClick={() => captureLocation(true)}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 21c4-3.5 6-6.6 6-9.5C18 7 15.5 4 12 4S6 7 6 11.5c0 2.9 2 6 6 9.5z"></path>
              <circle cx="12" cy="11" r="2.5"></circle>
            </svg>
            {locating
              ? "Locating…"
              : coords
                ? "Location attached"
                : "Use my location"}
          </button>
        </div>
      </div>

      {error && (
        <p
          style={{
            fontSize: 13.5,
            color: "var(--destructive)",
            marginBottom: 14,
          }}
        >
          {error}
        </p>
      )}

      <button className="btn btn-primary" type="submit" disabled={isPending}>
        {isPending
          ? editing
            ? "Saving…"
            : "Logging…"
          : editing
            ? "Save check-in"
            : "Log drink"}
      </button>

      {editing && (
        <button
          type="button"
          className="btn btn-ghost"
          style={{ marginTop: 10, color: "var(--destructive)" }}
          disabled={isPending}
          onClick={handleDelete}
        >
          Delete check-in
        </button>
      )}
    </form>
  );
}
