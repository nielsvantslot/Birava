import { Skeleton, SkeletonRow } from "@/components/ui/skeleton";

export default function CrewLoading() {
  return (
    <>
      {/* crew identity */}
      <div className="section flush" style={{ padding: "20px 16px 16px" }}>
        <div
          style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}
        >
          <Skeleton className="h-14 w-14 rounded-full shrink-0" />
          <div className="grow space-y-2">
            <Skeleton className="h-[22px] w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
        <div className="event">
          <Skeleton className="h-3 w-10" />
          <div className="members">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton
                key={i}
                className="h-[30px] w-[30px] rounded-full"
                style={{ marginLeft: i === 0 ? 0 : -8, border: "2px solid var(--surface)" }}
              />
            ))}
          </div>
          <Skeleton className="h-3 w-24" style={{ marginLeft: "auto" }} />
        </div>
      </div>

      {/* leaderboard */}
      <div className="section">
        <div className="h-row" style={{ marginBottom: 2 }}>
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-3 w-full max-w-64 mb-3" />
        <div className="metric-seg">
          <Skeleton className="h-9 flex-1 rounded-full" />
          <Skeleton className="h-9 flex-1 rounded-full" />
        </div>
        <div className="lb">
          {[0, 1, 2, 3].map((i) => (
            <div className="lr" key={i}>
              <Skeleton className="h-4 w-4 shrink-0" />
              <Skeleton className="h-[42px] w-[42px] rounded-full shrink-0" />
              <div className="grow space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-4 w-6 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* crew activity */}
      <div className="section">
        <div className="h-row">
          <Skeleton className="h-5 w-36" />
        </div>
        {[0, 1].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </div>

      {/* crew settings */}
      <div className="section">
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
    </>
  );
}
