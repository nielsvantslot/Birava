export default function PeopleLoading() {
  return (
    <div className="space-y-6 py-4">
      <div>
        <div className="h-8 w-36 rounded-lg bg-[var(--muted)] animate-pulse" />
        <div className="h-4 w-40 rounded mt-1.5 bg-[var(--muted)] animate-pulse" />
      </div>

      {/* Search bar skeleton */}
      <div className="h-10 w-full rounded-lg bg-[var(--muted)] animate-pulse" />

      {/* People list skeleton */}
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[var(--muted)] animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-24 rounded bg-[var(--muted)] animate-pulse" />
                <div className="h-3 w-16 rounded bg-[var(--muted)] animate-pulse" />
              </div>
              <div className="h-8 w-20 rounded-lg bg-[var(--muted)] animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
