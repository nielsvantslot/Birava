import {
  Skeleton,
  SkeletonCard,
  SkeletonPageHeader,
} from "@/components/ui/skeleton";

export default function StatsLoading() {
  return (
    <div className="space-y-6 py-4">
      <SkeletonPageHeader titleWidth="w-40" subtitleWidth="w-28" />

      {/* Last 24h recap */}
      <SkeletonCard className="space-y-3">
        <Skeleton className="h-5 w-36" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-1.5 text-center">
              <Skeleton className="h-8 w-12 mx-auto" />
              <Skeleton className="h-3 w-16 mx-auto" />
            </div>
          ))}
        </div>
      </SkeletonCard>

      {/* Charts */}
      {[...Array(2)].map((_, i) => (
        <SkeletonCard key={i} className="space-y-3">
          <Skeleton className={i === 0 ? "h-5 w-28" : "h-5 w-32"} />
          <Skeleton className="h-48 rounded-lg" />
        </SkeletonCard>
      ))}
    </div>
  );
}
