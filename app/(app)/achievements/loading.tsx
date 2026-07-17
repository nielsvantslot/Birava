import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function AchievementsLoading() {
  return (
    <div className="space-y-6 py-4">
      {/* Active-weeks streak */}
      <SkeletonCard className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-10 w-16" />
          <Skeleton className="h-10 w-16" />
        </div>
        <Skeleton className="h-8 w-full rounded-lg" />
      </SkeletonCard>

      {/* Discovery achievement grid */}
      <div className="grid grid-cols-2 gap-3">
        {[...Array(6)].map((_, i) => (
          <SkeletonCard key={i} className="space-y-2">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}
