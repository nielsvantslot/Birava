"use client";

import { useState, useTransition, useCallback } from "react";
import Link from "next/link";
import { FollowButton } from "@/components/beer/follow-button";
import { searchUsers } from "@/lib/controllers/socialController";

interface UserResult {
  id: string;
  username: string;
  avatarUrl: string | null;
}

interface PeopleClientProps {
  followingIds: string[];
  currentUserId: string;
}

export function PeopleClient({
  followingIds,
  currentUserId,
}: PeopleClientProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [, startTransition] = useTransition();

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    startTransition(async () => {
      const data = await searchUsers({ query: value.trim() });
      setResults(data as UserResult[]);
      setSearched(true);
    });
  }, []);

  const followingSet = new Set(followingIds);

  return (
    <>
      <div className="field" style={{ marginBottom: 4 }}>
        <label htmlFor="people-search">Username</label>
        <input
          id="people-search"
          type="text"
          placeholder="Search by username…"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          autoFocus
        />
      </div>

      {searched && results.length === 0 && (
        <p style={{ fontSize: 14, color: "var(--ink-dim)", padding: "14px 0" }}>
          No one matches that username.
        </p>
      )}

      {results.map((u) => (
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
                <img src={u.avatarUrl} alt={u.username} />
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
              initialIsFollowing={followingSet.has(u.id)}
            />
          )}
        </div>
      ))}

      {!searched && (
        <p style={{ fontSize: 14, color: "var(--ink-dim)", padding: "14px 0" }}>
          Follow people and their sessions land on your Home feed. Type at
          least 2 characters to search.
        </p>
      )}
    </>
  );
}
