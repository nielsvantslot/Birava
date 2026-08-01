"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createGroup, joinGroupByInvite, leaveGroup, closeGroup } from "@/lib/controllers/groupController";
import { showToast } from "@/components/ui/toast-pill";

export function CreateCrewForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createGroup({ name });
      if (result.error) {
        setError(result.error);
        return;
      }
      showToast(`Crew created — share code ${result.inviteCode}`);
      setName("");
      router.refresh();
    });
  };

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
      {error && (
        <p style={{ fontSize: 13, color: "#E5837A", marginBottom: 12 }}>
          {error}
        </p>
      )}
      <button className="btn btn-primary" type="submit" disabled={isPending}>
        {isPending ? "Creating…" : "Create crew"}
      </button>
    </form>
  );
}

export function JoinCrewForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await joinGroupByInvite({ inviteCode: code });
      if (result.error) {
        setError(result.error);
        return;
      }
      showToast(`Joined ${result.groupName} — you're ranked from today`);
      setCode("");
      router.refresh();
    });
  };

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
      {error && (
        <p style={{ fontSize: 13, color: "#E5837A", marginBottom: 12 }}>
          {error}
        </p>
      )}
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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    if (!window.confirm("Leave this crew? You'll need a fresh invite to rejoin.")) return;
    startTransition(async () => {
      const result = await leaveGroup({ groupId: crewId });
      if (result.error) {
        showToast(result.error);
        return;
      }
      showToast("Left the crew");
      router.push("/crews");
      router.refresh();
    });
  };

  return (
    <button className="btn btn-ghost" onClick={handleClick} disabled={isPending}>
      {isPending ? "Leaving…" : "Leave crew"}
    </button>
  );
}

/** Owner-only: stop new check-ins from counting toward the leaderboard and block new joins. */
export function CloseCrewButton({ crewId }: { crewId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    if (
      !window.confirm(
        "Close this crew? Existing stats stay visible, but check-ins after this point won't count, and no one new can join."
      )
    )
      return;
    startTransition(async () => {
      const result = await closeGroup({ groupId: crewId });
      if (result.error) {
        showToast(result.error);
        return;
      }
      showToast("Crew closed");
      router.refresh();
    });
  };

  return (
    <button className="btn btn-ghost" onClick={handleClick} disabled={isPending}>
      {isPending ? "Closing…" : "Close crew"}
    </button>
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
