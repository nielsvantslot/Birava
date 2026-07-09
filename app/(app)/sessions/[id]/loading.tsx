import { Skeleton } from "@/components/ui/skeleton";

export default function SessionLoading() {
  return (
    <>
      <div className="section flush" style={{ padding: "16px" }}>
        <div style={{ display: "flex", gap: 11, alignItems: "center" }}>
          <Skeleton className="h-[42px] w-[42px] rounded-full" />
          <div style={{ flex: 1 }}>
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <Skeleton className="h-7 w-44 mt-4 mb-4" />
        <div style={{ display: "flex", gap: 24 }}>
          <Skeleton className="h-10 w-16" />
          <Skeleton className="h-10 w-16" />
          <Skeleton className="h-10 w-20" />
        </div>
      </div>
      <div className="section flush">
        <Skeleton className="h-[250px] w-full rounded-none" />
      </div>
      <div className="section">
        <Skeleton className="h-6 w-28 mb-4" />
        <Skeleton className="h-12 w-full mb-2" />
        <Skeleton className="h-12 w-full mb-2" />
        <Skeleton className="h-12 w-full" />
      </div>
    </>
  );
}
