import {
  Skeleton,
  SkeletonAvatarRow,
  SkeletonPageHeader,
} from "@/components/ui/skeleton";

export default function PeopleLoading() {
  return (
    <div className="space-y-6 py-4">
      <SkeletonPageHeader titleWidth="w-36" subtitleWidth="w-40" />

      {/* Search bar */}
      <Skeleton className="h-10 w-full rounded-lg" />

      {/* People list */}
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <SkeletonAvatarRow
            key={i}
            line1Width="w-24"
            line2Width="w-16"
            right={<Skeleton className="h-8 w-20 rounded-lg" />}
          />
        ))}
      </div>
    </div>
  );
}
