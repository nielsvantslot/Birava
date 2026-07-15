import { SkeletonAvatarRow } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
  return (
    <div className="space-y-2 py-4">
      {[...Array(6)].map((_, i) => (
        <SkeletonAvatarRow key={i} line1Width="w-40" line2Width="w-24" />
      ))}
    </div>
  );
}
