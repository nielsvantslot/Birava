"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PhotoUploadPreparer, PhotoUploader } from "@/modules/photo-upload/client";
import type { PhotoUploadResultDto } from "@/modules/photo-upload/client";
import { editDrink, deleteDrink } from "@/lib/controllers/drinkController";
import { showToast } from "@/components/ui/toast-pill";
import { confirmModal } from "@/components/ui/confirm-modal";
import { DrinkEntry, DrinkType, DRINK_TYPES } from "@/lib/types";
import { drinkPhotoSrc, cn } from "@/lib/utils";
import { DRINK_PHOTO_MAX_DIMENSION, DRINK_PHOTO_MAX_UPLOAD_BYTES, drinkPhotoUploadEndpoints } from "@/lib/photoUploadConfig";
import { addPendingCheckin } from "@/lib/offline/pendingCheckins";
import type { PendingCheckinPhoto } from "@/lib/offline/pendingCheckins";
import { flushPendingCheckins } from "@/lib/offline/syncPendingCheckins";

type Coords = { lat: number; lng: number };

function getPosition(options: PositionOptions): Promise<Coords> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        }),
      reject,
      options
    );
  });
}

// JPEG canvas-encode quality (0-1) is a client-only concern — the server's
// WebP quality (0-100, lib/photoUpload.ts) is a different encoder/scale, not
// the same number, so it isn't shared here.
const PHOTO_COMPRESS_CONFIG = { maxDimension: DRINK_PHOTO_MAX_DIMENSION, quality: 0.85 };

// nominatim.openstreetmap.org has no request timeout of its own — on a bad
// connection it can hang far longer than the location fix it's just
// prefilling a venue name for, so this bounds it independently.
const REVERSE_GEOCODE_TIMEOUT_MS = 5000;

async function reverseGeocode(coords: Coords): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REVERSE_GEOCODE_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lng}&zoom=18`,
      { headers: { Accept: "application/json" }, signal: controller.signal }
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
  } finally {
    clearTimeout(timeout);
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
  const [type, setType] = useState<DrinkType>(
    editEntry?.drink_type ?? DRINK_TYPES[0]
  );
  const [venue, setVenue] = useState(editEntry?.venue ?? "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  // Photos are displayed through /api/photos/[entryId]; the raw
  // photo_url is a storage handle, never an <img> src.
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    editEntry?.photo_url ? drinkPhotoSrc(editEntry.id) : null
  );
  // Revokes the outgoing blob URL whenever a new photo replaces it and on
  // unmount — createObjectURL memory is otherwise held until the tab closes.
  // A no-op for the initial edit-mode value (drinkPhotoSrc(...) isn't a blob:
  // URL).
  useEffect(() => {
    return () => {
      if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<Coords | null>(
    editEntry?.lat != null && editEntry?.lng != null
      ? { lat: editEntry.lat, lng: editEntry.lng }
      : null
  );
  const [locating, setLocating] = useState(false);
  // Distinguishes "just started" from "still going" so the button never
  // just sits on a static "Locating…" for the whole worst-case wait.
  const [locatingSlow, setLocatingSlow] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Tracks a photo upload kicked off the moment it was picked (see
  // handlePhotoChange), so handleSubmit can reuse it instead of starting a
  // fresh one — most of the time it's already resolved by the time the user
  // finishes typing the drink name/venue and hits submit. `result` is filled
  // in once the promise settles so the create path can check synchronously
  // (no awaiting, no network-speed-dependent wait) whether it's ready to use.
  const pendingUploadRef = useRef<{
    file: File;
    promise: Promise<PhotoUploadResultDto>;
    controller: AbortController;
    result: PhotoUploadResultDto | null;
  } | null>(null);

  const captureLocation = async (announce: boolean) => {
    setLocating(true);
    setLocatingSlow(false);
    const slowTimer = setTimeout(() => setLocatingSlow(true), 4000);
    try {
      let position: Coords;
      try {
        position = await getPosition({ enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 });
      } catch (err) {
        // Permission denial won't change on a retry; a weak/slow high-accuracy
        // fix (timeout or position-unavailable) might succeed with a coarser
        // one — worth the extra wait only when the user is actively watching
        // for it, not for the silent page-load enrichment attempt.
        if ((err as GeolocationPositionError)?.code === 1 || !announce) throw err;
        position = await getPosition({ enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 });
      }
      setCoords(position);
      if (announce) showToast("Location attached");
      // Not awaited: the venue-name lookup can hang far longer than the
      // location fix itself on a bad connection, and coords are already
      // captured/submittable — don't let it hold up `locating`.
      reverseGeocode(position).then((suggestion) => {
        // Only prefill the venue if the user hasn't typed one meanwhile
        if (suggestion) setVenue((v) => (v.trim() ? v : suggestion));
      });
    } catch {
      if (announce) showToast("Couldn't get your location");
    } finally {
      clearTimeout(slowTimer);
      setLocating(false);
      setLocatingSlow(false);
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
  // blob (the user is discarding this photo entirely, or handleSubmit ended up
  // not using it — see below), false just stops tracking it without touching
  // storage (the URL is about to be legitimately used).
  const discardPendingUpload = (deleteIfAlreadyUploaded: boolean) => {
    const previous = pendingUploadRef.current;
    pendingUploadRef.current = null;
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
  };

  // Two layered "the user is leaving" signals, covering what
  // discardPendingUpload's other call sites don't:
  // - unmount: in-app navigation away from this form (back button, a nav
  //   link, closing an edit modal) while the tab stays open.
  // - pagehide, when not `persisted`: the tab/app is actually closing, not
  //   just being frozen into the back/forward cache — a `persisted` pagehide
  //   can still come back verbatim via bfcache restore, and deleting the
  //   blob there would leave pendingUploadRef pointing at a URL the server
  //   just 404s, so it's deliberately skipped.
  // Neither runs if the OS kills a backgrounded mobile app outright — no JS
  // executes at all when that happens, so nothing client-side can catch it.
  // photoCleanupCommands.ts's daily sweep is the real backstop for that case
  // (and for any of these best-effort sends that just don't land).
  useEffect(() => {
    const onPageHide = (e: PageTransitionEvent) => {
      if (!e.persisted) discardPendingUpload(true);
    };
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      discardPendingUpload(true);
    };
  }, []);

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
    const entry = { file: prepared, promise, controller, result: null as PhotoUploadResultDto | null };
    pendingUploadRef.current = entry;
    promise.then((result) => {
      if (pendingUploadRef.current === entry) entry.result = result;
    });
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

  const handleDelete = async () => {
    if (!editEntry) return;
    const confirmed = await confirmModal({
      title: "Delete this check-in?",
      message: "There's no undo.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
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

    if (!name.trim()) {
      setError("Give it a name.");
      return;
    }

    startTransition(async () => {
      try {
        if (editEntry) {
          await submitEdit(editEntry);
          return;
        }
        await submitCreate();
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  };

  // Editing is unchanged: uploads normally (blocking, with a real error on
  // failure) and navigates to the session on success. Not in scope for the
  // durability/pre-upload-reuse work below — see submitCreate.
  const submitEdit = async (entry: DrinkEntry) => {
    let photoUrl: string | null = !photoFile && photoPreview ? (entry.photo_url ?? null) : null;
    let photoLqip: string | null = !photoFile && photoPreview ? (entry.photo_lqip ?? null) : null;

    if (photoFile) {
      if (photoFile.size > DRINK_PHOTO_MAX_UPLOAD_BYTES) {
        setError("Photo is too large. Please use a smaller photo.");
        return;
      }

      const pending = pendingUploadRef.current;
      const usingPending = pending !== null && pending.file === photoFile;
      const uploadResult = pending && usingPending
        ? await pending.promise
        : await PhotoUploader.upload(photoFile, drinkPhotoUploadEndpoints(userId, supportsDirectUpload));
      if (usingPending) discardPendingUpload(false); // consumed — don't delete it

      if ("error" in uploadResult) {
        setError(uploadResult.error);
        return;
      }
      photoUrl = uploadResult.url;
      photoLqip = uploadResult.lqip;
    }

    const result = await editDrink({
      id: entry.id,
      drinkName: name.trim() || null,
      drinkType: type,
      venue: venue.trim() || null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      photoUrl,
      photoLqip,
    });
    if (result.error) {
      setError(result.error);
      return;
    }
    showToast("Check-in updated");
    router.push(`/sessions/${entry.session_id}`);
    router.refresh();
  };

  // Creating is queue-first: durable the instant the user hits submit,
  // regardless of connection speed, and never blocks on the network — a slow
  // request can no longer lose the check-in by the tab closing mid-flight,
  // and nothing here holds the user on this page or redirects them anywhere,
  // so they're free to navigate away immediately. The actual save (photo
  // upload + addDrink) happens in flushPendingCheckins, fired in the
  // background right after queueing — on a fast connection that's over in a
  // moment; on a slow/dropped one, it just stays queued for
  // PendingCheckinsSync to pick up whenever connectivity (and the app) comes
  // back.
  const submitCreate = async () => {
    let photoForQueue: PendingCheckinPhoto;
    if (!photoFile) {
      photoForQueue = { kind: "none" };
    } else if (photoFile.size > DRINK_PHOTO_MAX_UPLOAD_BYTES) {
      setError("Photo is too large. Please use a smaller photo.");
      return;
    } else {
      // Use the pre-upload only if it actually already resolved successfully
      // — checked synchronously (no awaiting) so a slow/incomplete pre-upload
      // can never hold up queueing. Anything else (still in flight, or it
      // resolved with an error) falls back to the raw bytes, which
      // flushPendingCheckins will upload fresh when it syncs this entry.
      const cached = pendingUploadRef.current?.file === photoFile ? pendingUploadRef.current.result : null;
      if (cached && !("error" in cached)) {
        photoForQueue = { kind: "uploaded", url: cached.url, lqip: cached.lqip };
        discardPendingUpload(false); // consumed — don't delete it
      } else {
        photoForQueue = {
          kind: "raw",
          arrayBuffer: await photoFile.arrayBuffer(),
          type: photoFile.type || "image/jpeg",
          name: photoFile.name,
        };
        // Not consumed — if the pre-upload finishes later anyway, it's an
        // orphan the moment it resolves with a URL.
        discardPendingUpload(true);
      }
    }

    await addPendingCheckin({
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      payload: {
        drinkName: name.trim() || null,
        drinkType: type,
        venue: venue.trim() || null,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      },
      photo: photoForQueue,
    });

    showToast("Logged — added to tonight's session");
    setName("");
    setVenue("");
    clearPhotoUi();
    flushPendingCheckins(userId, supportsDirectUpload, { silent: true }).catch(() => {});
  };

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
              ? locatingSlow
                ? "Still trying…"
                : "Locating…"
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

      <button className="btn btn-primary" type="submit" disabled={isPending || !name.trim()}>
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
