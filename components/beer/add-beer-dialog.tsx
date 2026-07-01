"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Beer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { BeerEntry } from "@/lib/types";
import { triggerConfetti, checkAchievements } from "@/lib/achievements";

const BEER_STYLES = [
  "Lager",
  "Pilsner",
  "IPA",
  "Pale Ale",
  "Wheat Beer",
  "Stout",
  "Porter",
  "Sour",
  "Hefeweizen",
  "Blonde Ale",
  "Amber Ale",
  "Saison",
  "Trappist",
  "Lambic",
  "Other",
];

function getInitialForm(entry?: BeerEntry) {
  return {
    beer_name: entry?.beer_name ?? "",
    brewery: entry?.brewery ?? "",
    style: entry?.style ?? "",
    amount: entry?.amount?.toString() ?? "1",
    notes: entry?.notes ?? "",
    group_id: entry?.group_id ?? "none",
    created_at: entry?.created_at
      ? new Date(entry.created_at).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16),
  };
}

interface AddBeerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: BeerEntry;
}

export function AddBeerDialog({ open, onOpenChange, entry }: AddBeerDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEditing = !!entry;
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [form, setForm] = useState(() => getInitialForm(entry));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(getInitialForm(entry));
    setError(null);
  }, [entry, open]);

  useEffect(() => {
    if (!open) return;
    const fetchGroups = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: memberships } = await supabase
        .from("group_members")
        .select("groups(id, name)")
        .eq("user_id", user.id);
      const g =
        memberships?.flatMap((m) =>
          Array.isArray(m.groups) ? m.groups : m.groups ? [m.groups] : []
        ) ?? [];
      setGroups(g);
    };
    fetchGroups();
  }, [open]);

  const set = (key: keyof typeof form) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("You need to be signed in to save beers.");
      return;
    }

    startTransition(async () => {
      const { data: profile, error: profileLookupError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileLookupError) {
        setError(profileLookupError.message);
        return;
      }

      if (!profile) {
        const username =
          typeof user.user_metadata?.username === "string" &&
          user.user_metadata.username.trim().length > 0
            ? user.user_metadata.username.trim()
            : `${(user.email?.split("@")[0] ?? "beerlover").replace(/[^a-zA-Z0-9_-]/g, "") || "beerlover"}-${user.id.slice(0, 8)}`;

        const { error: profileInsertError } = await supabase
          .from("profiles")
          .insert({ id: user.id, username });

        if (profileInsertError) {
          setError(profileInsertError.message);
          return;
        }
      }

      const payload = {
        user_id: user.id,
        beer_name: form.beer_name || null,
        brewery: form.brewery || null,
        style: form.style || null,
        amount: parseFloat(form.amount) || 1,
        notes: form.notes || null,
        group_id: form.group_id === "none" ? null : (form.group_id || null),
        created_at: new Date(form.created_at).toISOString(),
      };

      let saveError: { message: string } | null = null;

      if (isEditing) {
        const { error: updateError } = await supabase
          .from("beer_entries")
          .update(payload)
          .eq("id", entry.id);
        saveError = updateError;
      } else {
        const { error: insertError } = await supabase
          .from("beer_entries")
          .insert(payload);
        saveError = insertError;
      }

      if (saveError) {
        setError(saveError.message);
        return;
      }

      if (!isEditing) {
        // Check achievements
        const { count, error: countError } = await supabase
          .from("beer_entries")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);
        if (!countError) {
          const achieved = checkAchievements(count ?? 0);
          if (achieved) triggerConfetti();
        }
      }

      setForm(getInitialForm());
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Beer className="h-5 w-5 text-[var(--primary)]" />
            {isEditing ? "Edit Beer" : "Add a Beer 🍺"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="beer_name">Beer Name</Label>
              <Input
                id="beer_name"
                placeholder="e.g. Heineken"
                value={form.beer_name}
                onChange={(e) => set("beer_name")(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="brewery">Brewery</Label>
              <Input
                id="brewery"
                placeholder="e.g. AB InBev"
                value={form.brewery}
                onChange={(e) => set("brewery")(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Style</Label>
              <Select value={form.style} onValueChange={set("style")}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a style" />
                </SelectTrigger>
                <SelectContent>
                  {BEER_STYLES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                min="0.5"
                max="10"
                step="0.5"
                value={form.amount}
                onChange={(e) => set("amount")(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="created_at">Date & Time</Label>
            <Input
              id="created_at"
              type="datetime-local"
              value={form.created_at}
              onChange={(e) => set("created_at")(e.target.value)}
            />
          </div>

          {groups.length > 0 && (
            <div className="space-y-1.5">
              <Label>Group</Label>
              <Select value={form.group_id} onValueChange={set("group_id")}>
                <SelectTrigger>
                  <SelectValue placeholder="No group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No group</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any notes..."
              value={form.notes}
              onChange={(e) => set("notes")(e.target.value)}
              rows={2}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : isEditing ? "Save Changes" : "🍺 Add Beer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
