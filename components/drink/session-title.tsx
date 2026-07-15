"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, X } from "lucide-react";
import { renameSession } from "@/lib/controllers/drinkController";
import { showToast } from "@/components/ui/toast-pill";

const MAX_SESSION_NAME_LENGTH = 40;

/**
 * The session detail page's serif title, editable in place for the owner.
 * `defaultTitle` (sessionTitle() ignoring any custom name) lets clearing
 * the name show the correct fallback instantly, without a round trip.
 */
export function SessionTitle({
  sessionId,
  title,
  defaultTitle,
  isOwnName,
  isSelf,
}: {
  sessionId: string;
  title: string;
  defaultTitle: string;
  isOwnName: boolean;
  isSelf: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [displayed, setDisplayed] = useState(title);
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!isSelf) {
    return (
      <div className="act-title" style={{ paddingBottom: 14 }}>
        {displayed}
      </div>
    );
  }

  if (editing) {
    const save = () => {
      const trimmed = value.trim();
      const prev = displayed;
      setEditing(false);
      setDisplayed(trimmed || defaultTitle);
      startTransition(async () => {
        const result = await renameSession({ id: sessionId, name: trimmed || null });
        if (result.error) {
          showToast(result.error);
          setDisplayed(prev);
        }
      });
    };

    return (
      <div className="act-title-row" style={{ paddingBottom: 14 }}>
        <input
          autoFocus
          className="act-title-input"
          value={value}
          maxLength={MAX_SESSION_NAME_LENGTH}
          disabled={isPending}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder={defaultTitle}
        />
        <button type="button" className="act-title-edit" onClick={save} disabled={isPending} aria-label="Save name">
          <Check size={16} />
        </button>
        <button
          type="button"
          className="act-title-edit"
          onClick={() => setEditing(false)}
          disabled={isPending}
          aria-label="Cancel"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="act-title-row">
      <div className="act-title" style={{ paddingBottom: 0 }}>
        {displayed}
      </div>
      <button
        type="button"
        className="act-title-edit"
        onClick={() => {
          setValue(isOwnName ? displayed : "");
          setEditing(true);
        }}
        aria-label="Rename session"
      >
        <Pencil size={15} />
      </button>
    </div>
  );
}
