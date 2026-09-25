"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createGroup,
  joinGroupByInvite,
  leaveGroup,
  closeGroup,
  deleteGroup,
  renameGroup,
  regenerateInviteCode,
} from "@/lib/controllers/groupController";
import { showToast } from "@/components/ui/toast-pill";
import { confirmModal, ConfirmModalOptions } from "@/components/ui/confirm-modal";
import { FieldError } from "@/components/ui/field-error";
import { invalidateCachedPages } from "@/lib/swCache";

/**
 * The confirm-then-mutate-then-toast/revalidate/redirect shape shared by
 * every owner-only destructive crew action below (leave/close/delete/
 * regenerate-code) — used to be 4 copy-pasted button components differing
 * only in copy, the action called, and where (if anywhere) it redirects.
 */
function ConfirmActionButton<T extends { error?: string; revalidatedPaths?: string[] }>({
  confirm,
  action,
  successToast,
  extraRevalidatePaths = [],
  redirectTo,
  idleLabel,
  pendingLabel,
}: {
  confirm: ConfirmModalOptions;
  action: () => Promise<T>;
  successToast: string | ((result: T) => string);
  extraRevalidatePaths?: string[];
  redirectTo?: string;
  idleLabel: string;
  pendingLabel: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = async () => {
    const confirmed = await confirmModal(confirm);
    if (!confirmed) return;
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        showToast(result.error);
        return;
      }
      showToast(typeof successToast === "function" ? successToast(result) : successToast);
      invalidateCachedPages([...(result.revalidatedPaths ?? []), ...extraRevalidatePaths]);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    });
  };

  return (
    <button className="btn btn-ghost" onClick={handleClick} disabled={isPending}>
      {isPending ? pendingLabel : idleLabel}
    </button>
  );
}

/**
 * The value/error/pending state machine shared by CreateCrewForm and
 * JoinCrewForm below — each form's JSX (labels, placeholders, button
 * variant, extra input attrs, whether it clears its error on every
 * keystroke) stays independent, since those genuinely differ between the
 * two; only the submit/toast/revalidate/reset plumbing was duplicated.
 */
function useSingleFieldCrewForm<T extends { error?: string; revalidatedPaths?: string[] }>(
  submit: (value: string) => Promise<T>,
  successToast: (result: T) => string
) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await submit(value);
      if (result.error) {
        setError(result.error);
        return;
      }
      showToast(successToast(result));
      setValue("");
      invalidateCachedPages(result.revalidatedPaths ?? []);
      router.refresh();
    });
  };

  return { value, setValue, error, setError, isPending, handleSubmit };
}

export function CreateCrewForm() {
  const { value: name, setValue: setName, error, isPending, handleSubmit } = useSingleFieldCrewForm(
    (name) => createGroup({ name }),
    (result) => `Crew created — share code ${result.inviteCode}`
  );

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="crew-name">Crew name</label>
        <input
          id="crew-name"
          type="text"
          placeholder="Tuscany Summer…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      {error && <FieldError>{error}</FieldError>}
      <button className="btn btn-primary" type="submit" disabled={isPending}>
        {isPending ? "Creating…" : "Create crew"}
      </button>
    </form>
  );
}

export function JoinCrewForm() {
  const { value: code, setValue: setCode, error, setError, isPending, handleSubmit } = useSingleFieldCrewForm(
    (code) => joinGroupByInvite({ inviteCode: code }),
    (result) => `Joined ${result.groupName} — you're ranked from today`
  );

  return (
    <form onSubmit={handleSubmit}>
      <div className="field" style={{ marginBottom: 8 }}>
        <label htmlFor="invite">Invite code</label>
        <input
          id="invite"
          type="text"
          placeholder="e.g. ALPS26"
          autoComplete="off"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(null);
          }}
        />
      </div>
      {error && <FieldError>{error}</FieldError>}
      <button
        className="btn btn-ghost"
        type="submit"
        disabled={isPending}
        style={{ marginTop: error ? 0 : 8 }}
      >
        {isPending ? "Joining…" : "Join crew"}
      </button>
    </form>
  );
}

/** Non-owner members can leave; the crew owner has no such action (leaveGroup blocks it). */
export function LeaveCrewButton({ crewId }: { crewId: string }) {
  return (
    <ConfirmActionButton
      confirm={{ title: "Leave this crew?", message: "You'll need a fresh invite to rejoin.", confirmLabel: "Leave", danger: true }}
      action={() => leaveGroup({ groupId: crewId })}
      successToast="Left the crew"
      redirectTo="/crews"
      idleLabel="Leave crew"
      pendingLabel="Leaving…"
    />
  );
}

/** Owner-only: stop new check-ins from counting toward the leaderboard and block new joins. */
export function CloseCrewButton({ crewId }: { crewId: string }) {
  return (
    <ConfirmActionButton
      confirm={{
        title: "Close this crew?",
        message: "Existing stats stay visible, but check-ins after this point won't count, and no one new can join.",
        confirmLabel: "Close crew",
        danger: true,
      }}
      action={() => closeGroup({ groupId: crewId })}
      successToast="Crew closed"
      extraRevalidatePaths={[`/crews/${crewId}`]}
      idleLabel="Close crew"
      pendingLabel="Closing…"
    />
  );
}

/**
 * Owner-only: permanently deletes the crew — no undo, unlike close. Requires
 * typing the crew name to confirm, since this removes it for every member,
 * not just the owner.
 */
export function DeleteCrewButton({ crewId, crewName }: { crewId: string; crewName: string }) {
  return (
    <ConfirmActionButton
      confirm={{
        title: "Delete this crew?",
        message: `This permanently deletes "${crewName}" for every member — there's no undo.`,
        confirmLabel: "Delete crew",
        danger: true,
        confirmText: crewName,
      }}
      action={() => deleteGroup({ groupId: crewId })}
      successToast="Crew deleted"
      redirectTo="/crews"
      idleLabel="Delete crew"
      pendingLabel="Deleting…"
    />
  );
}

/** Owner-only: renames the crew. The id, invite code, and every existing link/stat stay put. */
export function RenameCrewForm({ crewId, name }: { crewId: string; name: string }) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const trimmed = value.trim();
  const unchanged = trimmed === name;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (unchanged) return;
    setError(null);
    startTransition(async () => {
      const result = await renameGroup({ groupId: crewId, name: trimmed });
      if (result.error) {
        setError(result.error);
        return;
      }
      showToast("Crew renamed");
      invalidateCachedPages([...(result.revalidatedPaths ?? []), `/crews/${crewId}`]);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="section">
      <div className="field" style={{ marginBottom: error ? 8 : 12 }}>
        <label htmlFor="crew-rename">Crew name</label>
        <input
          id="crew-rename"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      {error && <FieldError>{error}</FieldError>}
      <button className="btn btn-ghost" type="submit" disabled={isPending || unchanged}>
        {isPending ? "Saving…" : "Save name"}
      </button>
    </form>
  );
}

/**
 * Owner-only: rotates the invite code, immediately invalidating the old
 * one — anyone who saved or was shown it can no longer join with it.
 */
export function RegenerateInviteCodeButton({ crewId }: { crewId: string }) {
  return (
    <ConfirmActionButton
      confirm={{
        title: "Get a new invite code?",
        message: "The current code stops working immediately — anyone who has it will need the new one to join.",
        confirmLabel: "Generate new code",
        danger: true,
      }}
      action={() => regenerateInviteCode({ groupId: crewId })}
      successToast={(result) => `New code ${result.inviteCode} — share it with the crew`}
      extraRevalidatePaths={[`/crews/${crewId}`]}
      idleLabel="Get a new invite code"
      pendingLabel="Generating…"
    />
  );
}

/** The crew's invite code — tap to copy. */
export function CopyCodeChip({ code }: { code: string }) {
  return (
    <button
      className="code"
      style={{ letterSpacing: 0, cursor: "pointer" }}
      onClick={async () => {
        await navigator.clipboard.writeText(code);
        showToast(`Code ${code} copied — share it with the crew`);
      }}
    >
      {code}
    </button>
  );
}
