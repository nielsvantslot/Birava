"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { followUser, unfollowUser } from "@/lib/controllers/socialController";

interface FollowButtonProps {
  targetUserId: string;
  initialIsFollowing: boolean;
  className?: string;
}

export function FollowButton({
  targetUserId,
  initialIsFollowing,
  className,
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleClick = () => {
    const next = !isFollowing;
    setIsFollowing(next); // optimistic
    startTransition(async () => {
      try {
        if (next) {
          await followUser({ targetUserId });
        } else {
          await unfollowUser({ targetUserId });
        }
        // Refresh so the server-rendered follower/following counts update.
        router.refresh();
      } catch {
        setIsFollowing(!next); // revert on error
      }
    });
  };

  return (
    <button
      type="button"
      className={cn("btn", isFollowing ? "btn-ghost" : "btn-primary", className)}
      onClick={handleClick}
      disabled={isPending}
    >
      {isFollowing ? (
        <>
          <UserCheck className="h-3.5 w-3.5 mr-1" />
          Following
        </>
      ) : (
        <>
          <UserPlus className="h-3.5 w-3.5 mr-1" />
          Follow
        </>
      )}
    </button>
  );
}
