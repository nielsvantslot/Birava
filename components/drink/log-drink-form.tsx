"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addDrink,
  editDrink,
  deleteDrink,
} from "@/lib/controllers/drinkController";
import { triggerConfetti } from "@/lib/achievements";
import { showToast } from "@/components/ui/toast-pill";
import { DrinkEntry, DRINK_TYPES } from "@/lib/types";
import { drinkPhotoSrc, cn } from "@/lib/utils";

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

const HEIC_EXTENSIONS = [".heic", ".heif"];
const HEIC_MIME_TYPES = ["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"];

function isHeicFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return HEIC_EXTENSIONS.some((ext) => name.endsWith(ext)) || HEIC_MIME_TYPES.includes(file.type);
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
export function CheckinForm({ editEntry }: { editEntry?: DrinkEntry }) {
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

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);

    // The original file still uploads as-is and gets converted server-side
    // (lib/storage/heic.ts) — this is only so the preview isn't blank, since
    // Chrome/Firefox/Edge can't render HEIC (iPhone's default photo format)
    // in an <img> tag at all.
    if (!isHeicFile(file)) {
      setPhotoPreview(URL.createObjectURL(file));
      return;
    }

    try {
      const convert = (await import("heic-convert/browser")).default;
      const buffer = new Uint8Array(await file.arrayBuffer());
      const jpeg = await convert({ buffer, format: "JPEG", quality: 0.9 });
      setPhotoPreview(URL.createObjectURL(new Blob([Uint8Array.from(jpeg)], { type: "image/jpeg" })));
    } catch {
      setPhotoPreview(null);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
      // Keep the existing storage handle when the photo is untouched;
      // clear it when the preview was removed.
      let photoUrl: string | null =
        !photoFile && photoPreview ? (editEntry?.photo_url ?? null) : null;

      if (photoFile) {
        const formData = new FormData();
        formData.append("file", photoFile);
        const res = await fetch("/api/uploads/drink-photo", {
          method: "POST",
          body: formData,
        });
        const result = (await res.json().catch(() => null)) as
          | { error?: string; publicUrl?: string }
          | null;
        if (!res.ok || !result?.publicUrl) {
          setError(result?.error ?? "Failed to upload photo.");
          return;
        }
        photoUrl = result.publicUrl;
      }

      const payload = {
        drinkName: name.trim() || null,
        drinkType: type,
        venue: venue.trim() || null,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        notes: editEntry?.notes ?? null,
        photoUrl: photoUrl,
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

      const result = await addDrink(payload);
      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.achievementUnlocked) triggerConfetti();
      showToast("Logged — added to tonight's session");

      setName("");
      setVenue("");
      handleRemovePhoto();
      router.push(`/sessions/${result.id}`);
      router.refresh();
    });
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
