"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Beer } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
              </div>

              <div className="flex gap-1 shrink-0">
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
    </>
  );
}
