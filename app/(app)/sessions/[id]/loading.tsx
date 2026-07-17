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
      <div className="section flush" style={{ padding: "6px 0 14px" }}>
        <div style={{ padding: "12px 16px 2px" }}>
          <Skeleton className="h-6 w-28" />
        </div>
        <div className="checkin-grid">
          {[...Array(6)].map((_, i) => (
            <div className="grid-item" key={i}>
              <Skeleton className="absolute inset-0 rounded-none" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
