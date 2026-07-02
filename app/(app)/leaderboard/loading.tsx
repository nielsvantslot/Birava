export default function LeaderboardLoading() {
  return (
    <div className="space-y-6 py-4">
      <div>
        <div className="h-8 w-32 rounded-lg bg-[var(--muted)] animate-pulse" />
        <div className="h-4 w-44 rounded mt-1.5 bg-[var(--muted)] animate-pulse" />
      </div>

      {/* Create group skeleton */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
        <div className="h-5 w-32 rounded bg-[var(--muted)] animate-pulse" />
        <div className="flex gap-2">
          <div className="h-10 flex-1 rounded-lg bg-[var(--muted)] animate-pulse" />
          <div className="h-10 w-20 rounded-lg bg-[var(--muted)] animate-pulse" />
        </div>
      </div>

      {/* Join group skeleton */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
        <div className="h-5 w-28 rounded bg-[var(--muted)] animate-pulse" />
        <div className="flex gap-2">
          <div className="h-10 flex-1 rounded-lg bg-[var(--muted)] animate-pulse" />
          <div className="h-10 w-16 rounded-lg bg-[var(--muted)] animate-pulse" />
        </div>
      </div>

      {/* Groups list skeleton */}
      <div className="space-y-2">
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-[var(--muted)] animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-28 rounded bg-[var(--muted)] animate-pulse" />
                <div className="h-3 w-16 rounded bg-[var(--muted)] animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
