import {
  Skeleton,
  SkeletonAvatarRow,
  SkeletonPageHeader,
} from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div className="space-y-6 py-4">
      <SkeletonPageHeader titleWidth="w-36" subtitleWidth="w-24" />

      {/* Avatar card */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-3 w-24" />
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
            <Skeleton className="h-8 w-10 mx-auto" />
            <Skeleton className="h-3 w-14 mx-auto" />
          </div>
        ))}
      </div>

      {/* Recent beers */}
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <SkeletonAvatarRow key={i} />
        ))}
      </div>
    </div>
  );
}
