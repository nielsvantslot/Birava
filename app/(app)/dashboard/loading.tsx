import { Skeleton, SkeletonAvatarRow } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6 py-4">
      {/* Tab strip */}
      <div className="flex gap-6 px-1">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-14" />
      </div>

      {/* Feed */}
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <SkeletonAvatarRow key={i} line1Width="w-40" line2Width="w-24" />
        ))}
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </div>
  );
}
