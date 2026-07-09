import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { getSocialFeed } from "@/lib/actions/social";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FeedEntry } from "@/lib/types";
import { beerPhotoSrc, formatDate } from "@/lib/utils";
import { Beer } from "lucide-react";
import { FeedPhotoDownload } from "@/components/beer/feed-photo-download";


export default async function FeedPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const entries: FeedEntry[] = await getSocialFeed(30, 0);

  return (
    <div className="space-y-6 py-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black">Feed 📡</h1>
          <p className="text-[var(--muted-foreground)] text-sm mt-0.5">
            What your friends are drinking
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/people">Find Friends</Link>
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="text-5xl mb-3">📡</span>
          <p className="font-semibold text-[var(--foreground)]">Nothing here yet</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1 mb-4">
            Follow some friends to see their beers here.
          </p>
          <Button asChild>
            <Link href="/people">Find Friends</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <Link href={`/profile/${entry.username}`} className="shrink-0">
                    <Avatar className="h-9 w-9">
                      {entry.avatar_url && (
                        <AvatarImage src={entry.avatar_url} />
                      )}
                      <AvatarFallback className="bg-[var(--primary)]/20 text-[var(--primary)] font-bold text-sm">
                        {entry.username[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Link>

                  <div className="flex-1 min-w-0">
                    {/* User + beer name row */}
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
                      <div className="mt-2 relative">
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
                      <FeedPhotoDownload
                        entryId={entry.id}
                        beerName={entry.beer_name}
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
