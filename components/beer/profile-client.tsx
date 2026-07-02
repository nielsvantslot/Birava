"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Pencil, Check, X, Users } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { getEarnedAchievements } from "@/lib/achievements";

interface ProfileClientProps {
  username: string;
  email: string;
  avatarUrl: string | null;
  totalBeers: number;
  streak: number;
  avgPerDay: string;
  memberSince: string;
  followers: number;
  following: number;
}

export function ProfileClient({
  username,
  email,
  avatarUrl,
  totalBeers,
  streak,
  avgPerDay,
  memberSince,
  followers,
  following,
}: ProfileClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [editedUsername, setEditedUsername] = useState(username);
  const [error, setError] = useState<string | null>(null);

  const achievements = getEarnedAchievements(totalBeers);

  const handleSaveUsername = () => {
    const trimmed = editedUsername.trim();
    if (!trimmed || trimmed === username) {
      setIsEditing(false);
      setEditedUsername(username);
      return;
    }
    if (trimmed.length < 2) {
      setError("Username must be at least 2 characters.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ username: trimmed })
        .eq("id", (await supabase.auth.getUser()).data.user!.id);
      if (updateError) {
        setError(
          updateError.message.includes("unique")
            ? "That username is already taken."
            : "Failed to update username."
        );
        return;
      }
      setIsEditing(false);
      router.refresh();
    });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedUsername(username);
    setError(null);
  };

  const handleSignOut = () => {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
    });
  };

  return (
    <div className="space-y-6 py-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black">Profile 👤</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-0.5">
          Your account
        </p>
      </div>

      {/* Avatar + identity */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 text-xl">
              {avatarUrl && <AvatarImage src={avatarUrl} />}
              <AvatarFallback className="bg-[var(--primary)]/20 text-[var(--primary)] font-black">
                {username[0]?.toUpperCase() ?? "?"}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="space-y-1">
                  <Input
                    value={editedUsername}
                    onChange={(e) => setEditedUsername(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveUsername();
                      if (e.key === "Escape") handleCancelEdit();
                    }}
                    className="h-8 text-sm font-semibold"
                    autoFocus
                    maxLength={32}
                  />
                  {error && (
                    <p className="text-xs text-[var(--destructive)]">{error}</p>
                  )}
                  <div className="flex gap-1 mt-1">
                    <Button
                      size="sm"
                      className="h-7 px-2 gap-1"
                      onClick={handleSaveUsername}
                      disabled={isPending}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 gap-1"
                      onClick={handleCancelEdit}
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="font-bold text-lg truncate">{username}</p>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors flex-shrink-0"
                    aria-label="Edit username"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <p className="text-sm text-[var(--muted-foreground)] truncate">
                {email}
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                Member since {memberSince}
              </p>
              <div className="flex gap-4 mt-1.5 text-xs text-[var(--muted-foreground)]">
                <span>
                  <span className="font-semibold text-[var(--foreground)]">
                    {followers}
                  </span>{" "}
                  followers
                </span>
                <span>
                  <span className="font-semibold text-[var(--foreground)]">
                    {following}
                  </span>{" "}
                  following
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-3">
          Stats
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-[var(--primary)] bg-[var(--primary)]/5">
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-black text-[var(--primary)]">
                {totalBeers}
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                Total 🍺
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-black">{streak}d</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                Streak 🔥
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-black">{avgPerDay}</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                Avg/day 📊
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Find friends */}
      <Button asChild variant="outline" className="w-full gap-2">
        <Link href="/people">
          <Users className="h-4 w-4" />
          Find Friends
        </Link>
      </Button>

      {/* Achievements */}
      {achievements.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-3">
            Achievements
          </h2>
          <div className="flex flex-wrap gap-2">
            {achievements.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-1.5 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/20 px-3 py-1.5"
              >
                <span className="text-lg">{a.emoji}</span>
                <div>
                  <p className="text-sm font-semibold text-[var(--primary)] leading-tight">
                    {a.label}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)] leading-tight">
                    {a.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sign out */}
      <div className="pt-2">
        <Button
          variant="outline"
          className="w-full gap-2 text-[var(--destructive)] border-[var(--destructive)]/30 hover:bg-[var(--destructive)]/10"
          onClick={handleSignOut}
          disabled={isPending}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
