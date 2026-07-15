import { SkeletonAvatarRow, SkeletonPageHeader } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
  return (
    <div className="space-y-6 py-4">
      <SkeletonPageHeader titleWidth="w-36" subtitleWidth="w-48" />

      <div className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <SkeletonAvatarRow key={i} line1Width="w-40" line2Width="w-24" />
        ))}
      </div>
    </div>
  );
}
