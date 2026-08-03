import { ProfileHeadSkeleton, RecentSessionsSkeleton } from "@/components/ui/skeleton";

export default function PublicProfileLoading() {
  return (
    <>
      <ProfileHeadSkeleton showFollowButton />
      <RecentSessionsSkeleton />
    </>
  );
}
