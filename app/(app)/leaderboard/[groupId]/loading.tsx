export default function GroupLeaderboardLoading() {
  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 rounded bg-[var(--muted)] animate-pulse" />
        <div>
          <div className="h-8 w-40 rounded-lg bg-[var(--muted)] animate-pulse" />
          <div className="h-4 w-28 rounded mt-1.5 bg-[var(--muted)] animate-pulse" />
        </div>
      </div>

      {/* Leaderboard rows */}
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-6 rounded bg-[var(--muted)] animate-pulse shrink-0" />
              <div className="h-10 w-10 rounded-full bg-[var(--muted)] animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-24 rounded bg-[var(--muted)] animate-pulse" />
                <div className="h-3 w-16 rounded bg-[var(--muted)] animate-pulse" />
              </div>
              <div className="h-6 w-12 rounded-full bg-[var(--muted)] animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
