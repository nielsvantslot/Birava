"use client";

import { useEffect } from "react";
import { FormDirtyTracker } from "@/lib/serviceWorkerUpdate/FormDirtyTracker";

/**
 * Lets ServiceWorkerRegistration defer a deploy's reload instead of silently
 * discarding what's typed — see FormDirtyTracker's own comment. Two separate
 * effects deliberately: the unmount cleanup must only fire once, on a real
 * unmount, not on every keystroke — a cleanup keyed to the field values would
 * mark clean (and could fire a deferred reload) between every re-render, the
 * instant before the same effect's own body reasserts dirty.
 */
export function useFormDirtyTracking(name: string, venue: string, photoFile: File | null) {
  useEffect(() => {
    const dirty = Boolean(name.trim() || venue.trim() || photoFile);
    if (dirty) FormDirtyTracker.markDirty();
    else FormDirtyTracker.markClean();
  }, [name, venue, photoFile]);
  useEffect(() => {
    // Navigating away from /log already loses whatever was typed here the
    // same way React unmounting always does, so a reload after that point
    // isn't destroying anything the user hasn't already left.
    return () => FormDirtyTracker.markClean();
  }, []);
}
