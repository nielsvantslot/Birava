import { Skeleton, SessionCardSkeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6 py-4">
      {/* Tab strip — real tabs are "Following"/"You" (app/(app)/dashboard/page.tsx) */}
      <div className="flex gap-6 px-1">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-14" />
      </div>

      {/* Feed */}
      <div className="space-y-2">
        <SessionCardSkeleton />
        <SessionCardSkeleton />
      </div>
    </div>
  );
}
