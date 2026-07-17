import { Skeleton, SkeletonAvatarRow, SkeletonInputRow } from "@/components/ui/skeleton";

export default function CrewsLoading() {
  return (
    <div className="space-y-6 py-4">
      <div className="section">
        <div className="h-row">
          <h3>Your crews</h3>
        </div>
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <SkeletonAvatarRow key={i} line1Width="w-28" line2Width="w-36" right={<Skeleton className="h-4 w-16" />} />
          ))}
        </div>
      </div>

      <div className="section">
        <div className="h-row" style={{ marginBottom: 6 }}>
          <h3>Start a crew</h3>
        </div>
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-2/3 mb-4" />
        <SkeletonInputRow buttonWidth="w-16" />
      </div>

      <div className="section">
        <div className="h-row" style={{ marginBottom: 6 }}>
          <h3>Join with a code</h3>
        </div>
        <SkeletonInputRow buttonWidth="w-16" />
      </div>
    </div>
  );
}
