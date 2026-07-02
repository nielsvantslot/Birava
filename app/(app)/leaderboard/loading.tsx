import {
  Skeleton,
  SkeletonAvatarRow,
  SkeletonCard,
  SkeletonInputRow,
  SkeletonPageHeader,
} from "@/components/ui/skeleton";

export default function LeaderboardLoading() {
  return (
    <div className="space-y-6 py-4">
      <SkeletonPageHeader titleWidth="w-32" subtitleWidth="w-44" />

      {/* Create group */}
      <SkeletonCard className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <SkeletonInputRow buttonWidth="w-20" />
      </SkeletonCard>

      {/* Join group */}
      <SkeletonCard className="space-y-3">
        <Skeleton className="h-5 w-28" />
        <SkeletonInputRow buttonWidth="w-16" />
      </SkeletonCard>

      {/* Groups list */}
      <div className="space-y-2">
        {[...Array(2)].map((_, i) => (
          <SkeletonAvatarRow
            key={i}
            avatarSize="h-8 w-8"
            line1Width="w-28"
            line2Width="w-16"
          />
        ))}
      </div>
    </div>
  );
}
