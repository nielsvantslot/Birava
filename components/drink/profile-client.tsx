"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { avatarSrc } from "@/lib/utils";

interface ProfileHeadProps {
  userId: string;
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

// Read-only — same rendering as viewing someone else's profile
// (app/(app)/profile/[username]/page.tsx). Editing moved to
// /settings/profile (components/drink/profile-edit-form.tsx).
export function ProfileHead({
  userId,
  username,
  avatarUrl,
  memberSince,
  followers,
  following,
  stats,
}: ProfileHeadProps) {
  return (
    <div className="section flush">
      <div className="profile-head">
        <div className="avatar">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarSrc(userId)} alt={username} />
          ) : (
            username.slice(0, 2).toUpperCase()
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>{username}</h1>
          <p>member since {memberSince}</p>
          <div className="follow-counts">
            <Link href="/profile/followers" prefetch={false}>
              <b>{followers}</b>
              <span>followers</span>
            </Link>
            <Link href="/profile/following" prefetch={false}>
              <b>{following}</b>
              <span>following</span>
            </Link>
          </div>
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
      <Link href="/settings" className="btn btn-ghost" prefetch={false}>
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
