import {
  Skeleton,
  ProfileHeadSkeleton,
  RecentSessionsSkeleton,
  SkeletonRow,
} from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <>
      <ProfileHeadSkeleton />

      {/* Find people */}
      <div className="section">
        <SkeletonRow />
      </div>

      {/* Achievements */}
      <div className="section">
        <div className="h-row">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3.5 w-14" />
        </div>
        {[0, 1, 2].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </div>

      <RecentSessionsSkeleton showHeaderLink />
    </>
  );
}
