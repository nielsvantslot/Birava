"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <Button
      size="sm"
      variant={isFollowing ? "secondary" : "default"}
      className={className}
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
    </Button>
  );
}
