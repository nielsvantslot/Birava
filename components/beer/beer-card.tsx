"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Pencil, Trash2, Beer } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AddBeerDialog } from "@/components/beer/add-beer-dialog";
import { BeerEntry } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { deleteBeer } from "@/lib/actions/beer";

interface BeerCardProps {
  entry: BeerEntry;
  showUser?: boolean;
}

export function BeerCard({ entry, showUser }: BeerCardProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!confirm("Delete this beer entry?")) return;
    startTransition(async () => {
      const result = await deleteBeer(entry.id);
      if (result.error) {
        alert(`Failed to delete: ${result.error}`);
        return;
      }
      router.refresh();
    });
  };

  const handleDownload = async () => {
    if (!entry.photo_url) return;
    const response = await fetch(entry.photo_url);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${entry.beer_name ?? "beer"}.jpg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        layout
      >
        <Card>
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
                <Beer className="h-5 w-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-[var(--foreground)]">
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
                  {showUser && entry.profiles?.username && (
                    <span className="font-medium text-[var(--primary)] mr-1">
                      @{entry.profiles.username}
                    </span>
                  )}
                  {formatDate(entry.created_at)}
                </p>

                {entry.photo_url && (
                  <div className="mt-2 relative w-full">
                    <button
                      type="button"
                      className="block w-full cursor-zoom-in"
                      onClick={() => setPhotoOpen(true)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={entry.photo_url}
                        alt={entry.beer_name ?? "Beer photo"}
                        className="w-full max-h-64 object-cover rounded-lg border border-[var(--border)]"
                      />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1 shrink-0">
                {entry.photo_url && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleDownload}
                    title="Download photo"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-[var(--destructive)]"
                  onClick={handleDelete}
                  disabled={isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <AddBeerDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        entry={entry}
      />

      {entry.photo_url && (
        <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
          <DialogContent className="max-w-2xl overflow-hidden border-0 bg-transparent p-0 shadow-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={entry.photo_url}
              alt={entry.beer_name ?? "Beer photo"}
              className="max-h-[85vh] w-full rounded-xl object-contain"
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
