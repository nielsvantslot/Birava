import Link from "next/link";
import { avatarSrc } from "@/lib/utils";

interface RightRailProps {
  userId: string;
  username: string;
  avatarUrl?: string | null;
}

export function RightRail({ userId, username, avatarUrl }: RightRailProps) {
  // prefetch={false} on every link here: this rail renders on every
  // authenticated page, so its links sit in the viewport (and get prefetched)
  // on every single navigation — pure waste since staleTimes.dynamic is 0
  // (next.config.ts), meaning every navigation refetches regardless of what's
  // already prefetched.
  return (
    <aside className="right-rail hidden xl:flex flex-none sticky top-0 h-screen">
      <Link href="/profile" className="rail-profile" prefetch={false}>
        <span className="avatar">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarSrc(userId)} alt="" />
          ) : (
            username.slice(0, 2).toUpperCase()
          )}
        </span>
        <span className="grow">
          <b>{username}</b>
          <span className="rail-sub">View your profile</span>
        </span>
      </Link>

      <Link href="/people" className="rail-card" prefetch={false}>
        <b>Find people</b>
        <p>See who else on Birava is worth following.</p>
      </Link>

      <Link href="/achievements" className="rail-card" prefetch={false}>
        <b>Achievements</b>
        <p>Check your badges and what&apos;s next to unlock.</p>
      </Link>
    </aside>
  );
}
