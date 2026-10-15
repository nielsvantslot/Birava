"use client";

import { useEffect, useState } from "react";
import { showToast } from "@/components/ui/toast-pill";
import type { DrinkEntry } from "@/lib/types";
import { GeolocationClient } from "./GeolocationClient";
import type { Coords } from "./Models";

/**
 * Geolocation for the check-in form: the captured coordinates plus the
 * "locating" UI state. Prefills the venue name (via `setVenue`) from a
 * reverse-geocode, but only when the user hasn't typed one meanwhile.
 */
export function useVenueCapture({
  editEntry,
  setVenue,
}: {
  editEntry?: DrinkEntry;
  setVenue: (update: (current: string) => string) => void;
}) {
  const editing = !!editEntry;
  const [coords, setCoords] = useState<Coords | null>(
    editEntry?.lat != null && editEntry?.lng != null
      ? { lat: editEntry.lat, lng: editEntry.lng }
      : null
  );
  const [locating, setLocating] = useState(false);
  // Distinguishes "just started" from "still going" so the button never
  // just sits on a static "Locating…" for the whole worst-case wait.
  const [locatingSlow, setLocatingSlow] = useState(false);

  const captureLocation = async (announce: boolean) => {
    setLocating(true);
    setLocatingSlow(false);
    const slowTimer = setTimeout(() => setLocatingSlow(true), 4000);
    try {
      let position: Coords;
      try {
        position = await GeolocationClient.getPosition({ enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 });
      } catch (err) {
        // Permission denial won't change on a retry; a weak/slow high-accuracy
        // fix (timeout or position-unavailable) might succeed with a coarser
        // one — worth the extra wait only when the user is actively watching
        // for it, not for the silent page-load enrichment attempt.
        if ((err as GeolocationPositionError)?.code === 1 || !announce) throw err;
        position = await GeolocationClient.getPosition({ enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 });
      }
      setCoords(position);
      if (announce) showToast("Location attached");
      // Not awaited: the venue-name lookup can hang far longer than the
      // location fix itself on a bad connection, and coords are already
      // captured/submittable — don't let it hold up `locating`.
      GeolocationClient.reverseGeocode(position).then((suggestion) => {
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

  return { coords, locating, locatingSlow, captureLocation };
}
