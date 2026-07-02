"use client";

import { useState, useTransition, useCallback } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { FollowButton } from "@/components/beer/follow-button";
import { searchUsers } from "@/lib/actions/social";

interface UserResult {
  id: string;
  username: string;
  avatar_url: string | null;
}

interface PeopleClientProps {
  followingIds: string[];
  currentUserId: string;
}

export function PeopleClient({ followingIds, currentUserId }: PeopleClientProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [, startTransition] = useTransition();

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      if (value.trim().length < 2) {
        setResults([]);
        setSearched(false);
        return;
      }
      startTransition(async () => {
        const data = await searchUsers(value.trim());
        setResults(data as UserResult[]);
        setSearched(true);
      });
    },
    []
  );

  const followingSet = new Set(followingIds);

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
        <Input
          className="pl-9"
          placeholder="Search by username…"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          autoFocus
        />
      </div>

      {/* Results */}
      {searched && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <span className="text-4xl mb-3">🔍</span>
          <p className="font-semibold">No users found</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Try a different username.
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((u) => (
            <Card key={u.id}>
              <CardContent className="py-3">
                <div className="flex items-center gap-3">
                  <Link href={`/profile/${u.username}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar className="h-10 w-10 shrink-0">
                      {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                      <AvatarFallback className="bg-[var(--primary)]/20 text-[var(--primary)] font-bold">
                        {u.username[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <p className="font-semibold truncate">@{u.username}</p>
                  </Link>
                  {u.id !== currentUserId && (
                    <FollowButton
                      targetUserId={u.id}
                      initialIsFollowing={followingSet.has(u.id)}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!searched && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="text-5xl mb-3">🤝</span>
          <p className="font-semibold">Find your friends</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Type at least 2 characters to search.
          </p>
        </div>
      )}
    </div>
  );
}
