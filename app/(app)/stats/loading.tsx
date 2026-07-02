export default function StatsLoading() {
  return (
    <div className="space-y-6 py-4">
      <div>
        <div className="h-8 w-40 rounded-lg bg-[var(--muted)] animate-pulse" />
        <div className="h-4 w-28 rounded mt-1.5 bg-[var(--muted)] animate-pulse" />
      </div>

      {/* Last 24h recap skeleton */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
        <div className="h-5 w-36 rounded bg-[var(--muted)] animate-pulse" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-1.5 text-center">
              <div className="h-8 w-12 rounded mx-auto bg-[var(--muted)] animate-pulse" />
              <div className="h-3 w-16 rounded mx-auto bg-[var(--muted)] animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Chart skeleton */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
        <div className="h-5 w-28 rounded bg-[var(--muted)] animate-pulse" />
        <div className="h-48 rounded-lg bg-[var(--muted)] animate-pulse" />
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
        <div className="h-5 w-32 rounded bg-[var(--muted)] animate-pulse" />
        <div className="h-48 rounded-lg bg-[var(--muted)] animate-pulse" />
      </div>
    </div>
  );
}
