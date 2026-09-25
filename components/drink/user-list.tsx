import Link from "next/link";
import { FollowButton } from "@/components/drink/follow-button";
import { Avatar } from "@/components/ui/avatar";
import { UsernameLabel } from "@/components/ui/username-label";
import { EmptyState } from "@/components/ui/empty-state";
import type { UserSummaryDTO } from "@/lib/dtos";

interface UserListProps {
  users: UserSummaryDTO[];
  currentUserId: string;
  followingIds: Set<string>;
  emptyMessage: string;
}

/** Shared row rendering for followers/following lists — same look as the search results in people-client.tsx. */
export function UserList({ users, currentUserId, followingIds, emptyMessage }: UserListProps) {
  if (users.length === 0) {
    return <EmptyState>{emptyMessage}</EmptyState>;
  }

  return (
    <>
      {users.map((u) => (
        <div className="row" key={u.id}>
          {/* prefetch={false}: staleTimes.dynamic is 0 (next.config.ts), so
              prefetching every listed user's profile on render is pure
              waste. */}
          <Link
            href={`/profile/${u.username}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 13,
              flex: 1,
              minWidth: 0,
              textDecoration: "none",
              color: "inherit",
            }}
            prefetch={false}
          >
            <div className="avatar">
              <Avatar userId={u.id} username={u.username} avatarUrl={u.avatarUrl} lazy />
            </div>
            <UsernameLabel
              as="div"
              className="grow"
              block
              name={<b>{u.username}</b>}
              isDeveloper={u.isDeveloper}
            />
          </Link>
          {u.id !== currentUserId && (
            <FollowButton
              targetUserId={u.id}
              initialIsFollowing={followingIds.has(u.id)}
            />
          )}
        </div>
      ))}
    </>
  );
}
