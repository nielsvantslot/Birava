"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FeedEntry } from "@/lib/types";
import { beerPhotoSrc, formatDate } from "@/lib/utils";
import { Beer, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GroupActivityFeedProps {
  entries: FeedEntry[];
}

export function GroupActivityFeed({ entries }: GroupActivityFeedProps) {
  const handleDownload = async (entryId: string, beerName: string | null) => {
    const response = await fetch(beerPhotoSrc(entryId));
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${beerName ?? "beer"}.jpg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-bold">Recent Activity</h2>
        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
          Latest beers from this group
        </p>
      </div>

      {entries.map((entry) => (
        <Card key={entry.id}>
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Link href={`/profile/${entry.username}`} className="shrink-0">
                <Avatar className="h-9 w-9">
                  {entry.avatar_url && <AvatarImage src={entry.avatar_url} />}
                  <AvatarFallback className="bg-[var(--primary)]/20 text-[var(--primary)] font-bold text-sm">
                    {entry.username[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Link>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/profile/${entry.username}`}
                    className="font-semibold text-sm text-[var(--primary)] hover:underline"
                  >
                    @{entry.username}
                  </Link>
                  <span className="text-sm font-medium">
                    {entry.beer_name ?? "Beer"}
                  </span>
                  {entry.amount !== 1 && (
                    <Badge variant="secondary">×{entry.amount}</Badge>
                  )}
                  {entry.style && (
                    <Badge variant="outline">{entry.style}</Badge>
                  )}
                </div>

                {entry.brewery && (
                  <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                    {entry.brewery}
                  </p>
                )}

                {entry.notes && (
                  <p className="text-sm text-[var(--foreground)]/70 mt-1 italic">
                    &ldquo;{entry.notes}&rdquo;
                  </p>
                )}

                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  {formatDate(entry.created_at)}
                </p>

                {entry.photo_url && (
                  <div className="mt-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={beerPhotoSrc(entry.id)}
                      alt={entry.beer_name ?? "Beer photo"}
                      className="w-full max-h-64 object-cover rounded-lg border border-[var(--border)]"
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center gap-1 shrink-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
                  <Beer className="h-4 w-4" />
                </div>
                {entry.photo_url && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleDownload(entry.id, entry.beer_name)}
                    title="Download photo"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
