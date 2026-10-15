"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { editDrink, deleteDrink } from "@/modules/checkins/actions/drinkController";
import { addPendingCheckin } from "@/modules/checkins/client/pendingCheckins";
import { flushPendingCheckins } from "@/modules/checkins/client/syncPendingCheckins";
import { showToast } from "@/components/ui/toast-pill";
import { confirmModal } from "@/components/ui/confirm-modal";
import { invalidateCachedPages } from "@/lib/swCache";
import type { DrinkEntry, DrinkType } from "@/lib/types";
import type { Coords } from "./Models";
import type { usePhotoAttachment } from "./use-photo-attachment";

type FormFields = {
  name: string;
  type: DrinkType;
  venue: string;
  coords: Coords | null;
};

/**
 * Save and delete for the check-in form. Editing uploads normally (blocking,
 * with a real error on failure) and navigates to the session on success.
 * Creating is queue-first: durable the instant the user hits submit,
 * regardless of connection speed, and never blocks on the network — a slow
 * request can no longer lose the check-in by the tab closing mid-flight, and
 * nothing here holds the user on this page or redirects them anywhere, so
 * they're free to navigate away immediately. The actual save (photo upload +
 * addDrink) happens in flushPendingCheckins, fired in the background right
 * after queueing — on a fast connection that's over in a moment; on a
 * slow/dropped one, it just stays queued for PendingCheckinsSync to pick up
 * whenever connectivity (and the app) comes back.
 */
export function useCheckinSubmit({
  editEntry,
  userId,
  supportsDirectUpload,
  fields,
  photo,
  onCreated,
}: {
  editEntry?: DrinkEntry;
  userId: string;
  supportsDirectUpload: boolean;
  fields: FormFields;
  photo: ReturnType<typeof usePhotoAttachment>;
  /** Called after a new check-in is queued, to reset the form's own fields. */
  onCreated: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const payload = () => ({
    drinkName: fields.name.trim() || null,
    drinkType: fields.type,
    venue: fields.venue.trim() || null,
    lat: fields.coords?.lat ?? null,
    lng: fields.coords?.lng ?? null,
  });

  const submitEdit = async (entry: DrinkEntry) => {
    const resolved = await photo.resolveForEdit(entry);
    if ("error" in resolved) {
      setError(resolved.error);
      return;
    }

    const result = await editDrink({
      id: entry.id,
      ...payload(),
      photoUrl: resolved.photoUrl,
      photoLqip: resolved.photoLqip,
    });
    if (result.error) {
      setError(result.error);
      return;
    }
    showToast("Check-in updated");
    invalidateCachedPages(result.revalidatedPaths ?? []);
    router.push(`/sessions/${entry.session_id}`);
    router.refresh();
  };

  const submitCreate = async () => {
    const photoForQueue = await photo.photoForQueue();

    await addPendingCheckin({
      id: crypto.randomUUID(),
      userId,
      createdAt: Date.now(),
      payload: payload(),
      photo: photoForQueue,
    });

    showToast("Logged — added to tonight's session");
    onCreated();
    photo.clearPhotoUi();
    flushPendingCheckins(userId, supportsDirectUpload, { silent: true }).catch(() => {});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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
      invalidateCachedPages(result.revalidatedPaths ?? []);
      router.push("/log");
      router.refresh();
    });
  };

  return { isPending, error, handleSubmit, handleDelete };
}
