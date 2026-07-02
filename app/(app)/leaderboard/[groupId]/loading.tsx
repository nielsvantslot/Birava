import {
  Skeleton,
  SkeletonCard,
  SkeletonPageHeader,
} from "@/components/ui/skeleton";

export default function GroupLeaderboardLoading() {
  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-5" />
        <SkeletonPageHeader titleWidth="w-40" subtitleWidth="w-28" />
      </div>

      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <SkeletonCard key={i}>
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-6 shrink-0" />
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-6 w-12 rounded-full" />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}
