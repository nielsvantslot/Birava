export default function ProfileLoading() {
  return (
    <div className="space-y-6 py-4">
      <div>
        <div className="h-8 w-36 rounded-lg bg-[var(--muted)] animate-pulse" />
        <div className="h-4 w-24 rounded mt-1.5 bg-[var(--muted)] animate-pulse" />
      </div>

      {/* Avatar card */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-[var(--muted)] animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-28 rounded bg-[var(--muted)] animate-pulse" />
            <div className="h-3 w-36 rounded bg-[var(--muted)] animate-pulse" />
            <div className="h-3 w-24 rounded bg-[var(--muted)] animate-pulse" />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-center space-y-1.5"
          >
            <div className="h-8 w-10 rounded mx-auto bg-[var(--muted)] animate-pulse" />
            <div className="h-3 w-14 rounded mx-auto bg-[var(--muted)] animate-pulse" />
          </div>
        ))}
      </div>

      {/* Recent beers */}
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
  );
}
