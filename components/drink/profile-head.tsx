import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { UsernameLabel } from "@/components/ui/username-label";

interface ProfileHeadProps {
  userId: string;
  username: string;
  avatarUrl: string | null;
  isDeveloper: boolean;
  memberSince: string;
  followers: number;
  following: number;
  stats: {
    sessions: number;
    venues: number;
    types: number;
    activeWeeks: number;
  };
  /** A public profile links to /profile/<username>/followers instead. */
  followersHref?: string;
  followingHref?: string;
  /** Rendered next to the avatar/name block — a public profile's FollowButton. Omitted on the viewer's own profile. */
  action?: React.ReactNode;
}

// Shared by the viewer's own profile and app/(app)/profile/[username]/page.tsx
// (same rendering either way) — editing moved to /settings/profile
// (components/drink/profile-edit-form.tsx).
export function ProfileHead({
  userId,
  username,
  avatarUrl,
  isDeveloper,
  memberSince,
  followers,
  following,
  stats,
  followersHref = "/profile/followers",
  followingHref = "/profile/following",
  action,
}: ProfileHeadProps) {
  return (
    <div className="section flush">
      <div className="profile-head">
        <div className="avatar">
          <Avatar userId={userId} username={username} avatarUrl={avatarUrl} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <UsernameLabel as="h1" block name={username} isDeveloper={isDeveloper} />
          <p>member since {memberSince}</p>
          <div className="follow-counts">
            <Link href={followersHref} prefetch={false}>
              <b>{followers}</b>
              <span>followers</span>
            </Link>
            <Link href={followingHref} prefetch={false}>
              <b>{following}</b>
              <span>following</span>
            </Link>
          </div>
        </div>
        {action}
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
