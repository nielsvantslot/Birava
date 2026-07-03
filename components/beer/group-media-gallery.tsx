"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FeedEntry } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface GroupMediaGalleryProps {
  entries: FeedEntry[];
}

export function GroupMediaGallery({ entries }: GroupMediaGalleryProps) {
  const photos = entries.filter((e) => e.photo_url);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selected = selectedIndex === null ? null : photos[selectedIndex];
  const canGoPrevious = selectedIndex !== null && selectedIndex > 0;
  const canGoNext = selectedIndex !== null && selectedIndex < photos.length - 1;
  const currentPhotoNumber = selectedIndex === null ? null : selectedIndex + 1;

  const handleDownload = async (photoUrl: string, beerName: string | null) => {
    const response = await fetch(photoUrl);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${beerName ?? "beer"}.jpg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (photos.length === 0) return null;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-bold">Media Gallery</h2>
        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
          Photos from this group
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {photos.map((entry, index) => (
          <button
            key={entry.id}
            type="button"
            className="relative aspect-square overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--muted)] group focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            onClick={() => setSelectedIndex(index)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={entry.photo_url!}
              alt={entry.beer_name ?? "Beer photo"}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <p className="text-white text-xs font-semibold truncate">
                {entry.beer_name ?? "Beer"}
              </p>
              <p className="text-white/80 text-xs truncate">@{entry.username}</p>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <Dialog open onOpenChange={(open) => !open && setSelectedIndex(null)}>
          <DialogContent className="max-w-sm p-0 overflow-hidden">
            <div className="relative bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selected.photo_url!}
                alt={selected.beer_name ?? "Beer photo"}
                className="w-full object-contain max-h-[60vh]"
              />
              {canGoPrevious && (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute left-3 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full bg-black/55 text-white hover:bg-black/70"
                  onClick={() => setSelectedIndex((index) => (index === null ? index : index - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="sr-only">Previous image</span>
                </Button>
              )}
              {canGoNext && (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute right-3 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full bg-black/55 text-white hover:bg-black/70"
                  onClick={() => setSelectedIndex((index) => (index === null ? index : index + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                  <span className="sr-only">Next image</span>
                </Button>
              )}
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Link href={`/profile/${selected.username}`} className="shrink-0">
                  <Avatar className="h-9 w-9">
                    {selected.avatar_url && <AvatarImage src={selected.avatar_url} />}
                    <AvatarFallback className="bg-[var(--primary)]/20 text-[var(--primary)] font-bold text-sm">
                      {selected.username[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/profile/${selected.username}`}
                      className="font-semibold text-sm text-[var(--primary)] hover:underline"
                    >
                      @{selected.username}
                    </Link>
                    <span className="text-sm font-medium">
                      {selected.beer_name ?? "Beer"}
                    </span>
                    {selected.amount !== 1 && (
                      <Badge variant="secondary">×{selected.amount}</Badge>
                    )}
                    {selected.style && (
                      <Badge variant="outline">{selected.style}</Badge>
                    )}
                  </div>
                  {selected.brewery && (
                    <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                      {selected.brewery}
                    </p>
                  )}
                  {selected.notes && (
                    <p className="text-sm text-[var(--foreground)]/70 mt-1 italic">
                      &ldquo;{selected.notes}&rdquo;
                    </p>
                  )}
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    {formatDate(selected.created_at)}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    {currentPhotoNumber} of {photos.length}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                onClick={() => handleDownload(selected.photo_url!, selected.beer_name)}
              >
                <Download className="h-3.5 w-3.5" />
                Download Photo
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
