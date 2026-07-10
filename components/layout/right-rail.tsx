import Link from "next/link";

interface RightRailProps {
  username: string;
  avatarUrl?: string | null;
}

export function RightRail({ username, avatarUrl }: RightRailProps) {
  return (
    <aside className="right-rail hidden xl:flex flex-none sticky top-0 h-screen">
      <Link href="/profile" className="rail-profile">
        <span className="avatar">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" />
          ) : (
            username.slice(0, 2).toUpperCase()
          )}
        </span>
        <span className="grow">
          <b>{username}</b>
          <span className="rail-sub">View your profile</span>
        </span>
      </Link>

      <Link href="/people" className="rail-card">
        <b>Find people</b>
        <p>See who else on Birava is worth following.</p>
      </Link>

      <Link href="/achievements" className="rail-card">
        <b>Achievements</b>
        <p>Check your badges and what&apos;s next to unlock.</p>
      </Link>
    </aside>
  );
}
