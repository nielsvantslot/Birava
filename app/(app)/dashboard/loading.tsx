import { Skeleton, SessionCardSkeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <>
      {/* Tab strip — real tabs are "Following"/"You" (.tabs, app/globals.css) */}
      <div className="tabs">
        <div style={{ padding: "14px 0 12px", marginRight: 28 }}>
          <Skeleton className="h-4 w-20" />
        </div>
        <div style={{ padding: "14px 0 12px" }}>
          <Skeleton className="h-4 w-14" />
        </div>
      </div>

      {/* Feed */}
      <SessionCardSkeleton />
      <SessionCardSkeleton />
    </>
  );
}
