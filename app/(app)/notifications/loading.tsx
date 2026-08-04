import { SkeletonRow } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
  return (
    <div className="section">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <SkeletonRow key={i} line1Width="w-40" line2Width="w-24" />
      ))}
    </div>
  );
}
