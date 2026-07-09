import { Skeleton } from "@/components/ui/skeleton";

export default function CrewLoading() {
  return (
    <>
      <div className="section flush" style={{ padding: "20px 16px 16px" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
          <Skeleton className="h-[56px] w-[56px] rounded-full" />
          <div style={{ flex: 1 }}>
            <Skeleton className="h-6 w-40 mb-2" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
        <Skeleton className="h-[52px] w-full rounded-xl" />
      </div>
      <div className="section">
        <Skeleton className="h-6 w-32 mb-4" />
        <Skeleton className="h-12 w-full mb-2" />
        <Skeleton className="h-12 w-full mb-2" />
        <Skeleton className="h-12 w-full" />
      </div>
    </>
  );
}
