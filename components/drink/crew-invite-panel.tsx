"use client";

import { useState, useTransition } from "react";
import { getCrewInviteCandidates, sendCrewInvite } from "@/lib/controllers/groupController";
import { showToast } from "@/components/ui/toast-pill";
import { avatarSrc } from "@/lib/utils";

type Candidate = { userId: string; username: string; avatarUrl: string | null };

function CandidateRow({
  candidate,
  action,
}: {
  candidate: Candidate;
  action: React.ReactNode;
}) {
  return (
    <div className="row" key={candidate.userId}>
      <div className="avatar">
        {candidate.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarSrc(candidate.userId)} alt={candidate.username} />
        ) : (
          candidate.username.slice(0, 2).toUpperCase()
        )}
      </div>
      <div className="grow">
        <b>{candidate.username}</b>
      </div>
      {action}
    </div>
  );
}

/** Invite affordance on the crew detail page — opens a picker over mutual follows. */
export function CrewInvitePanel({ crewId }: { crewId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [pending, setPending] = useState<Candidate[]>([]);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleOpen = () => {
    setOpen(true);
    if (candidates !== null) return;
    setLoading(true);
    startTransition(async () => {
      const result = await getCrewInviteCandidates({ groupId: crewId });
      setCandidates(result?.candidates ?? []);
      setPending(result?.pending ?? []);
      setLoading(false);
    });
  };

  const handleInvite = (candidate: Candidate) => {
    setBusyId(candidate.userId);
    startTransition(async () => {
      const result = await sendCrewInvite({ groupId: crewId, invitedUserId: candidate.userId });
      if (result.error) {
        showToast(result.error);
      } else {
        showToast(`Invited ${candidate.username}`);
        setSentTo((s) => new Set(s).add(candidate.userId));
      }
      setBusyId(null);
    });
  };

  if (!open) {
    return (
      <div className="section">
        <button className="btn btn-ghost" onClick={handleOpen}>
          Invite someone
        </button>
      </div>
    );
  }

  return (
    <div className="section">
      <div className="h-row" style={{ marginBottom: 6 }}>
        <h3>Invite someone</h3>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--ink-dim)", marginBottom: 12 }}>
        Only people you mutually follow show up here.
      </p>

      {loading && (
        <p style={{ fontSize: 14, color: "var(--ink-dim)", padding: "14px 0" }}>Loading…</p>
      )}

      {!loading && candidates?.length === 0 && pending.length === 0 && (
        <p style={{ fontSize: 14, color: "var(--ink-dim)", padding: "14px 0" }}>
          No one to invite yet — you need to mutually follow someone first.
        </p>
      )}

      {!loading &&
        candidates?.map((c) => (
          <CandidateRow
            key={c.userId}
            candidate={c}
            action={
              <button
                className="btn btn-ghost"
                disabled={busyId === c.userId || sentTo.has(c.userId)}
                onClick={() => handleInvite(c)}
              >
                {sentTo.has(c.userId) ? "Invited" : busyId === c.userId ? "Inviting…" : "Invite"}
              </button>
            }
          />
        ))}

      {!loading && pending.length > 0 && (
        <>
          <div className="h-row" style={{ marginTop: 16, marginBottom: 6 }}>
            <h3>Pending</h3>
          </div>
          {pending.map((c) => (
            <CandidateRow key={c.userId} candidate={c} action={<span className="code">Invited</span>} />
          ))}
        </>
      )}
    </div>
  );
}
