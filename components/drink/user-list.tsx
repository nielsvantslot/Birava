import Link from "next/link";
import { FollowButton } from "@/components/drink/follow-button";
import { avatarSrc } from "@/lib/utils";
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
    return (
      <p style={{ fontSize: 14, color: "var(--ink-dim)", padding: "14px 0" }}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <>
      {users.map((u) => (
        <div className="row" key={u.id}>
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
          >
            <div className="avatar">
              {u.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarSrc(u.id)} alt={u.username} />
              ) : (
                u.username.slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="grow">
              <b>{u.username}</b>
            </div>
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
