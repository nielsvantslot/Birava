export default function HistoryLoading() {
  return (
    <div className="space-y-6 py-4">
      <div>
        <div className="h-8 w-36 rounded-lg bg-[var(--muted)] animate-pulse" />
        <div className="h-4 w-32 rounded mt-1.5 bg-[var(--muted)] animate-pulse" />
      </div>

      {[...Array(3)].map((_, day) => (
        <div key={day}>
          <div className="flex items-center justify-between mb-2">
            <div className="h-4 w-28 rounded bg-[var(--muted)] animate-pulse" />
            <div className="h-5 w-10 rounded-full bg-[var(--muted)] animate-pulse" />
          </div>
          <div className="space-y-2">
            {[...Array(day === 0 ? 3 : 2)].map((_, i) => (
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
      ))}
    </div>
  );
}
