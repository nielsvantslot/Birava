"use client";

import { useState, useTransition } from "react";
import { respondToCrewInvite } from "@/lib/controllers/groupController";
import { showToast } from "@/components/ui/toast-pill";

type Status = "pending" | "accepted" | "declined";

export function CrewInviteActions({ inviteId }: { inviteId: string }) {
  const [status, setStatus] = useState<Status>("pending");
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [, startTransition] = useTransition();

  const respond = (accept: boolean) => {
    setBusy(accept ? "accept" : "decline");
    startTransition(async () => {
      const result = await respondToCrewInvite({ inviteId, accept });
      if (result.error) {
        showToast(result.error);
      } else {
        setStatus(accept ? "accepted" : "declined");
      }
      setBusy(null);
    });
  };

  if (status === "accepted") return <span className="code">Joined</span>;
  if (status === "declined") return <span className="code">Declined</span>;

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button className="btn btn-ghost" disabled={busy !== null} onClick={() => respond(false)}>
        {busy === "decline" ? "…" : "Decline"}
      </button>
      <button className="btn btn-primary" disabled={busy !== null} onClick={() => respond(true)}>
        {busy === "accept" ? "…" : "Accept"}
      </button>
    </div>
  );
}
