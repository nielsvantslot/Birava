"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Beer, Camera, X } from "lucide-react";
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
import { BeerEntry } from "@/lib/types";
import { triggerConfetti } from "@/lib/achievements";
import { addBeer, editBeer } from "@/lib/actions/beer";
import { beerPhotoSrc } from "@/lib/utils";


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

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getInitialForm(entry?: BeerEntry, now?: Date) {
  return {
    beer_name: entry?.beer_name ?? "",
    brewery: entry?.brewery ?? "",
    style: entry?.style ?? "",
    amount: entry?.amount?.toString() ?? "1",
    notes: entry?.notes ?? "",
    created_at: entry?.created_at
      ? toDatetimeLocalValue(new Date(entry.created_at))
      : now
      ? toDatetimeLocalValue(now)
      : "",
    photo_url: entry?.photo_url ?? null as string | null,
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
  const [form, setForm] = useState(() => getInitialForm(entry));
  const [error, setError] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    entry?.photo_url ? beerPhotoSrc(entry.id) : null
  );
  const [removePhoto, setRemovePhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Populate created_at with current time on the client only
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm((prev) => ({
      ...prev,
      created_at: prev.created_at || toDatetimeLocalValue(new Date()),
    }));
  }, []);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(getInitialForm(entry, new Date()));
      setPhotoFile(null);
      setPhotoPreview(entry?.photo_url ? beerPhotoSrc(entry.id) : null);
      setRemovePhoto(false);
      setError(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key: keyof Omit<typeof form, "photo_url">) => (val: string) => {
    if (error) setError(null);
    setForm((f) => ({ ...f, [key]: val }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setRemovePhoto(false);
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setRemovePhoto(true);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      let photoUrl: string | null = form.photo_url;

      // Upload new photo if selected
      if (photoFile) {
        const formData = new FormData();
        formData.append("file", photoFile);

        const uploadResponse = await fetch("/api/uploads/beer-photo", {
          method: "POST",
          body: formData,
        });

        const uploadResult = (await uploadResponse.json().catch(() => null)) as
          | { error?: string; publicUrl?: string }
          | null;

        if (!uploadResponse.ok || !uploadResult?.publicUrl) {
          setError(uploadResult?.error ?? "Failed to upload photo.");
          return;
        }

        // Delete old photo if editing and replacing
        if (isEditing && entry?.photo_url) {
          await fetch("/api/uploads/beer-photo", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photoUrl: entry.photo_url }),
          });
        }

        photoUrl = uploadResult.publicUrl;
      } else if (removePhoto) {
        // Delete old photo from storage
        if (isEditing && entry?.photo_url) {
          await fetch("/api/uploads/beer-photo", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photoUrl: entry.photo_url }),
          });
        }
        photoUrl = null;
      }

      const payload = {
        beer_name: form.beer_name || null,
        brewery: form.brewery || null,
        style: form.style || null,
        amount: parseFloat(form.amount) || 1,
        notes: form.notes || null,
        photo_url: photoUrl,
        created_at: new Date(form.created_at).toISOString(),
      };

      let result: { error?: string; achievementUnlocked?: boolean };

      if (isEditing) {
        result = await editBeer(entry.id, payload);
      } else {
        result = await addBeer(payload);
      }

      if (result.error) {
        setError(result.error);
        return;
      }

      if (!isEditing && result.achievementUnlocked) {
        triggerConfetti();
      }

      setForm(getInitialForm(isEditing ? entry : undefined, isEditing ? undefined : new Date()));
      setPhotoFile(null);
      setPhotoPreview(null);
      setRemovePhoto(false);
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

          {/* Photo upload */}
          <div className="space-y-1.5">
            <Label>Photo</Label>
            {photoPreview ? (
              <div className="relative w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoPreview}
                  alt="Beer photo preview"
                  className="w-full max-h-48 object-cover rounded-lg border border-[var(--border)]"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={handleRemovePhoto}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div
                className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--border)] p-6 cursor-pointer hover:border-[var(--primary)] transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-6 w-6 text-[var(--muted-foreground)]" />
                <p className="text-sm text-[var(--muted-foreground)]">
                  Tap to add a photo
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              id="photo"
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoChange}
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
