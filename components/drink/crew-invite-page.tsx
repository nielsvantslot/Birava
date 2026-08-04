"use client";

import { useState, useTransition } from "react";
import { getCrewInviteCandidates, sendCrewInvite } from "@/lib/controllers/groupController";
import { showToast } from "@/components/ui/toast-pill";
import { avatarSrc } from "@/lib/utils";

type Candidate = { userId: string; username: string; avatarUrl: string | null };
type CandidatesResult = { candidates: Candidate[]; total: number; pending: Candidate[] };

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

/**
 * Dedicated invite screen (/crews/[id]/invite) rather than an inline panel —
 * a mutual-follow list can run into the hundreds, so it needs its own
 * search + pagination instead of dumping everyone into one page load.
 */
export function CrewInvitePage({
  crewId,
  initial,
}: {
  crewId: string;
  initial: CandidatesResult;
}) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>(initial.candidates);
  const [total, setTotal] = useState(initial.total);
  const [pending] = useState<Candidate[]>(initial.pending);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const runSearch = (value: string) => {
    setQuery(value);
    setLoading(true);
    startTransition(async () => {
      const result = await getCrewInviteCandidates({
        groupId: crewId,
        search: value.trim() || undefined,
      });
      setCandidates(result?.candidates ?? []);
      setTotal(result?.total ?? 0);
      setLoading(false);
    });
  };

  const loadMore = () => {
    setLoadingMore(true);
    startTransition(async () => {
      const result = await getCrewInviteCandidates({
        groupId: crewId,
        search: query.trim() || undefined,
        offset: candidates.length,
      });
      setCandidates((c) => [...c, ...(result?.candidates ?? [])]);
      setLoadingMore(false);
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

  return (
    <>
      <div className="section">
        <div className="field" style={{ marginBottom: 4 }}>
          <label htmlFor="crew-invite-search">Search</label>
          <input
            id="crew-invite-search"
            type="text"
            placeholder="Search mutual follows…"
            value={query}
            onChange={(e) => runSearch(e.target.value)}
            autoFocus
          />
        </div>
        <p style={{ fontSize: 12.5, color: "var(--ink-dim)" }}>
          Only people you mutually follow show up here.
        </p>
      </div>

      <div className="section">
        {loading && (
          <p style={{ fontSize: 14, color: "var(--ink-dim)", padding: "14px 0" }}>Loading…</p>
        )}

        {!loading && candidates.length === 0 && (
          <p style={{ fontSize: 14, color: "var(--ink-dim)", padding: "14px 0" }}>
            {query.trim()
              ? "No mutual follows match that search."
              : "No one to invite yet — you need to mutually follow someone first."}
          </p>
        )}

        {!loading &&
          candidates.map((c) => (
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

        {!loading && candidates.length < total && (
          <button
            className="btn btn-ghost"
            style={{ marginTop: 12 }}
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading…" : `Load more (${total - candidates.length} left)`}
          </button>
        )}
      </div>

      {pending.length > 0 && (
        <div className="section">
          <div className="h-row" style={{ marginBottom: 6 }}>
            <h3>Pending</h3>
          </div>
          {pending.map((c) => (
            <CandidateRow key={c.userId} candidate={c} action={<span className="code">Invited</span>} />
          ))}
        </div>
      )}
    </>
  );
}
