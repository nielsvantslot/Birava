import {
  Skeleton,
  SkeletonAvatarRow,
  SkeletonPageHeader,
} from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6 py-4">
      <SkeletonPageHeader titleWidth="w-40" subtitleWidth="w-28" />

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-2"
          >
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-8 w-12" />
          </div>
        ))}
      </div>

      {/* Recent sessions */}
      <div>
        <Skeleton className="h-4 w-28 mb-3" />
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <SkeletonAvatarRow key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
