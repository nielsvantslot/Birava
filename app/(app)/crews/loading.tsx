import { Skeleton, SkeletonInputRow } from "@/components/ui/skeleton";

export default function CrewsLoading() {
  return (
    <>
      <div className="section">
        <div className="h-row">
          <Skeleton className="h-5 w-28" />
        </div>
        {[0, 1].map((i) => (
          <div className="row" key={i}>
            <Skeleton className="h-[42px] w-[42px] rounded-full shrink-0" />
            <div className="grow space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-36" />
            </div>
            <Skeleton className="h-5 w-14 rounded-md shrink-0" />
          </div>
        ))}
      </div>

      <div className="section">
        <div className="h-row" style={{ marginBottom: 6 }}>
          <Skeleton className="h-5 w-28" />
        </div>
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-2/3 mb-4" />
        <SkeletonInputRow buttonWidth="w-16" />
      </div>

      <div className="section">
        <div className="h-row" style={{ marginBottom: 6 }}>
          <Skeleton className="h-5 w-40" />
        </div>
        <SkeletonInputRow buttonWidth="w-16" />
      </div>
    </>
  );
}
