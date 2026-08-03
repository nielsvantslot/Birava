import { Skeleton } from "@/components/ui/skeleton";

export default function AchievementsLoading() {
  return (
    <>
      {/* active-weeks streak, with recovery framing */}
      <div className="section">
        <div className="h-row" style={{ marginBottom: 2 }}>
          <Skeleton className="h-5 w-44" />
        </div>
        <div className="stats" style={{ marginTop: 12 }}>
          {[0, 1].map((i) => (
            <div className="stat" key={i}>
              <Skeleton className="h-[13px] w-16 mb-1.5" />
              <Skeleton className="h-6 w-10 mb-1.5" />
              <Skeleton className="h-[11px] w-24" />
            </div>
          ))}
        </div>
        <div className="weeks">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-lg" style={{ flex: 1 }} />
          ))}
        </div>
        <div className="weeks-legend">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="callout" style={{ margin: "16px 0 0" }}>
          <Skeleton className="rounded shrink-0" style={{ width: 22, height: 22 }} />
          <div style={{ flex: 1 }} className="space-y-1.5">
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      </div>

      {/* variety achievements */}
      <div className="section">
        <div className="h-row" style={{ marginBottom: 4 }}>
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="h-3.5 w-full mb-1" />
        <Skeleton className="h-3.5 w-2/3 mb-3.5" />
        <div className="ach-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="ach-card" key={i}>
              <Skeleton
                className="rounded-[11px]"
                style={{ width: 40, height: 40, marginBottom: 11 }}
              />
              <Skeleton className="h-3.5 w-20 mb-1.5" />
              <Skeleton className="h-3 w-full mb-1" />
              <Skeleton className="h-3 w-4/5" style={{ marginBottom: 11 }} />
              <Skeleton className="h-[5px] w-full rounded-full mb-1.5" />
              <Skeleton className="h-2.5 w-16" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
