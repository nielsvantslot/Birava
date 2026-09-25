"use client";

import { useState, useTransition, useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { FollowButton } from "@/components/drink/follow-button";
import { Avatar } from "@/components/ui/avatar";
import { UsernameLabel } from "@/components/ui/username-label";
import { searchUsers } from "@/lib/controllers/socialController";

const SEARCH_DEBOUNCE_MS = 300;

interface UserResult {
  id: string;
  username: string;
  avatarUrl: string | null;
  isDeveloper: boolean;
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against an in-flight search for a since-superseded query
  // resolving after a newer one and clobbering fresher results.
  const requestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = value.trim();
    if (trimmed.length < 2) {
      requestIdRef.current += 1;
      setResults([]);
      setSearched(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const requestId = ++requestIdRef.current;
      startTransition(async () => {
        const data = await searchUsers({ query: trimmed });
        if (requestIdRef.current !== requestId) return;
        setResults(data as UserResult[]);
        setSearched(true);
      });
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const followingSet = useMemo(() => new Set(followingIds), [followingIds]);

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
          {/* prefetch={false}: staleTimes.dynamic is 0 (next.config.ts), so
              prefetching every search result's profile on render is pure
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
