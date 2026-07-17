"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfileUsername } from "@/lib/controllers/profileController";
import type { AvatarUploadResultDTO } from "@/lib/dtos";

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
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked after an error
    if (!file) return;

    setAvatarUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/uploads/avatar", { method: "POST", body });
      const result = (await res.json().catch(() => null)) as AvatarUploadResultDTO | null;
      if (!res.ok) {
        setError(result?.error ?? "Couldn't upload that image.");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't upload that image.");
    } finally {
      setAvatarUploading(false);
    }
  };

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
        <div style={{ position: "relative", flex: "none" }}>
          <div
            className="avatar"
            role="button"
            tabIndex={0}
            aria-label="Change profile picture"
            title="Change profile picture"
            onClick={() => !avatarUploading && avatarInputRef.current?.click()}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !avatarUploading) {
                e.preventDefault();
                avatarInputRef.current?.click();
              }
            }}
            style={{ cursor: avatarUploading ? "default" : "pointer", opacity: avatarUploading ? 0.6 : 1 }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={username} />
            ) : (
              username.slice(0, 2).toUpperCase()
            )}
          </div>
          <span
            aria-hidden
            style={{
              position: "absolute",
              right: -2,
              bottom: -2,
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "var(--accent)",
              color: "var(--accent-ink)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid var(--bg)",
              pointerEvents: "none",
            }}
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="3.2"></circle>
            </svg>
          </span>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleAvatarChange}
          />
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
  return (
    <div className="section">
      <Link href="/settings" className="btn btn-ghost">
        Settings
      </Link>
    </div>
  );
}

export function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <button className="btn btn-ghost" onClick={handleSignOut}>
      Sign out
    </button>
  );
}
