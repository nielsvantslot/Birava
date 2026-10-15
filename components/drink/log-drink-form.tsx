"use client";

import { useState } from "react";
import { DrinkEntry, DrinkType, DRINK_TYPES } from "@/lib/types";
import { drinkPhotoSrc, cn } from "@/lib/utils";
import { FieldError } from "@/components/ui/field-error";
import type { Coords } from "./log-form/Models";
import { useDrinkSuggestions } from "./log-form/use-drink-suggestions";
import { useFormDirtyTracking } from "./log-form/use-form-dirty-tracking";
import { usePhotoAttachment } from "./log-form/use-photo-attachment";
import { useVenueCapture } from "./log-form/use-venue-capture";
import { useCheckinSubmit } from "./log-form/use-checkin-submit";

function PhotoField({
  photoPreview,
  fileInputRef,
  onFileChange,
  onRemove,
}: {
  photoPreview: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  return (
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
            onClick={onRemove}
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
        onChange={onFileChange}
      />
    </div>
  );
}

/** The venue field + "use my location" chip — purely presentational, all state/geolocation logic stays in CheckinForm. */
function LocationField({
  venue,
  onVenueChange,
  venueSuggestions,
  coords,
  locating,
  locatingSlow,
  onCaptureLocation,
}: {
  venue: string;
  onVenueChange: (value: string) => void;
  venueSuggestions: string[];
  coords: Coords | null;
  locating: boolean;
  locatingSlow: boolean;
  onCaptureLocation: () => void;
}) {
  return (
    <div className="field">
      <label htmlFor="venue">Venue</label>
      <input
        id="venue"
        type="text"
        placeholder="Where are you drinking?"
        value={venue}
        onChange={(e) => onVenueChange(e.target.value)}
        list={venueSuggestions.length > 0 ? "venue-suggestions" : undefined}
        autoComplete="off"
      />
      {venueSuggestions.length > 0 && (
        <datalist id="venue-suggestions">
          {venueSuggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <button
          type="button"
          className={cn("chip", coords && "on")}
          disabled={locating}
          onClick={onCaptureLocation}
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
  );
}

/**
 * The one log form — used for both creating and editing a check-in.
 * Deliberately small: type is the only required field, name/photo/venue are
 * all optional. Geolocation prefills the venue silently and never blocks
 * logging; name/venue get autocomplete suggestions from the user's own
 * recent check-ins (see getMyDrinkSuggestions) so a habitual drink/spot
 * doesn't need retyping.
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
  const editing = !!editEntry;
  const [name, setName] = useState(editEntry?.drink_name ?? "");
  const [type, setType] = useState<DrinkType>(
    editEntry?.drink_type ?? DRINK_TYPES[0]
  );
  const [venue, setVenue] = useState(editEntry?.venue ?? "");

  const { nameSuggestions, venueSuggestions } = useDrinkSuggestions(editing);
  const photo = usePhotoAttachment({
    userId,
    supportsDirectUpload,
    initialPreview: editEntry?.photo_url ? drinkPhotoSrc(editEntry.id) : null,
  });
  const { coords, locating, locatingSlow, captureLocation } = useVenueCapture({ editEntry, setVenue });
  useFormDirtyTracking(name, venue, photo.photoFile);

  const { isPending, error, handleSubmit, handleDelete } = useCheckinSubmit({
    editEntry,
    userId,
    supportsDirectUpload,
    fields: { name, type, venue, coords },
    photo,
    onCreated: () => {
      setName("");
      setVenue("");
    },
  });

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="drink-name">
          Drink{" "}
          <span style={{ color: "var(--ink-dim)", fontWeight: 500 }}>
            · optional
          </span>
        </label>
        <input
          id="drink-name"
          type="text"
          placeholder="Name or search…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          list={nameSuggestions.length > 0 ? "drink-name-suggestions" : undefined}
          autoComplete="off"
        />
        {nameSuggestions.length > 0 && (
          <datalist id="drink-name-suggestions">
            {nameSuggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
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

      <PhotoField
        photoPreview={photo.photoPreview}
        fileInputRef={photo.fileInputRef}
        onFileChange={photo.handlePhotoChange}
        onRemove={photo.handleRemovePhoto}
      />

      <LocationField
        venue={venue}
        onVenueChange={setVenue}
        venueSuggestions={venueSuggestions}
        coords={coords}
        locating={locating}
        locatingSlow={locatingSlow}
        onCaptureLocation={() => captureLocation(true)}
      />

      {error && <FieldError style={{ fontSize: 13.5, marginBottom: 14 }}>{error}</FieldError>}

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
