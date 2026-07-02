export default function DashboardLoading() {
  return (
    <div className="space-y-6 py-4">
      <div>
        <div className="h-8 w-40 rounded-lg bg-[var(--muted)] animate-pulse" />
        <div className="h-4 w-28 rounded mt-1.5 bg-[var(--muted)] animate-pulse" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-2"
          >
            <div className="h-3 w-16 rounded bg-[var(--muted)] animate-pulse" />
            <div className="h-8 w-12 rounded bg-[var(--muted)] animate-pulse" />
          </div>
        ))}
      </div>

      {/* Recent beers */}
      <div>
        <div className="h-4 w-28 rounded mb-3 bg-[var(--muted)] animate-pulse" />
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[var(--muted)] animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 rounded bg-[var(--muted)] animate-pulse" />
                  <div className="h-3 w-20 rounded bg-[var(--muted)] animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
