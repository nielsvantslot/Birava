import {
  Skeleton,
  SkeletonAvatarRow,
  SkeletonPageHeader,
} from "@/components/ui/skeleton";

export default function HistoryLoading() {
  return (
    <div className="space-y-6 py-4">
      <SkeletonPageHeader titleWidth="w-36" subtitleWidth="w-32" />

      {[...Array(3)].map((_, day) => (
        <div key={day}>
          <div className="flex items-center justify-between mb-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-10 rounded-full" />
          </div>
          <div className="space-y-2">
            {[...Array(day === 0 ? 3 : 2)].map((_, i) => (
              <SkeletonAvatarRow key={i} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
