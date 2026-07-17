"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfileUsername } from "@/lib/controllers/profileController";

interface ProfileHeadProps {
  username: string;
  avatarUrl: string | null;
  memberSince: string;
  followers: number;
  following: number;
  stats: {
    sessions: number;
    venues: number;
    types: number;
    activeWeeks: number;
  };
}

export function ProfileHead({
  username,
  avatarUrl,
  memberSince,
  followers,
  following,
  stats,
}: ProfileHeadProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [editedUsername, setEditedUsername] = useState(username);
  const [error, setError] = useState<string | null>(null);

  const handleSaveUsername = () => {
    const trimmed = editedUsername.trim();
    if (!trimmed || trimmed === username) {
      setIsEditing(false);
      setEditedUsername(username);
      return;
    }
    if (trimmed.length < 2) {
      setError("Username must be at least 2 characters.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const { error: updateError } = await updateProfileUsername({ username: trimmed });
      if (updateError) {
        setError(
          updateError === "unique constraint"
            ? "That username is taken."
            : updateError
        );
        return;
      }
      setIsEditing(false);
      router.refresh();
    });
  };

  return (
    <div className="section flush">
      <div className="profile-head">
        <div className="avatar">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={username} />
          ) : (
            username.slice(0, 2).toUpperCase()
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {isEditing ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                value={editedUsername}
                onChange={(e) => setEditedUsername(e.target.value)}
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  padding: "8px 12px",
                  font: "inherit",
                  fontSize: 16,
                  color: "var(--ink)",
                  width: "100%",
                  minWidth: 0,
                }}
                autoFocus
              />
              <button
                className="chip on"
                disabled={isPending}
                onClick={handleSaveUsername}
              >
                Save
              </button>
              <button
                className="chip"
                onClick={() => {
                  setIsEditing(false);
                  setEditedUsername(username);
                  setError(null);
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <h1
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
              }}
              title="Edit username"
              onClick={() => setIsEditing(true)}
            >
              {username}
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--ink-dim)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 3a2.8 2.8 0 114 4L7.5 20.5 2 22l1.5-5.5z"></path>
              </svg>
            </h1>
          )}
          <p>
            member since {memberSince} · {followers} followers · {following}{" "}
            following
          </p>
          {error && (
            <p style={{ color: "var(--destructive)", marginTop: 4 }}>{error}</p>
          )}
        </div>
      </div>
      <div style={{ padding: "0 16px 20px" }}>
        <div className="stats">
          <div className="stat">
            <div className="label">Sessions</div>
            <div className="num">{stats.sessions}</div>
          </div>
          <div className="stat">
            <div className="label">Venues</div>
            <div className="num">{stats.venues}</div>
          </div>
          <div className="stat">
            <div className="label">Types tried</div>
            <div className="num">{stats.types}</div>
          </div>
          <div className="stat">
            <div className="label">Active wks</div>
            <div className="num">{stats.activeWeeks}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProfileActions() {
  const router = useRouter();

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="section">
      <button className="btn btn-ghost" onClick={handleSignOut}>
        Sign out
      </button>
    </div>
  );
}
