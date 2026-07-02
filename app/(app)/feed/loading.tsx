export default function FeedLoading() {
  return (
    <div className="space-y-6 py-4">
      <div>
        <div className="h-8 w-32 rounded-lg bg-[var(--muted)] animate-pulse" />
        <div className="h-4 w-44 rounded mt-1.5 bg-[var(--muted)] animate-pulse" />
      </div>

      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
          >
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-full bg-[var(--muted)] animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <div className="h-4 w-20 rounded bg-[var(--muted)] animate-pulse" />
                  <div className="h-4 w-24 rounded bg-[var(--muted)] animate-pulse" />
                </div>
                <div className="h-3 w-32 rounded bg-[var(--muted)] animate-pulse" />
                <div className="h-3 w-16 rounded bg-[var(--muted)] animate-pulse" />
              </div>
              <div className="h-9 w-9 rounded-full bg-[var(--muted)] animate-pulse shrink-0" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
