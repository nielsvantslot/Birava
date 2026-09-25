import { Skeleton } from "@/components/ui/skeleton";

export default function LogLoading() {
  return (
    <div className="section" style={{ minHeight: 420 }}>
      {/* Not "Log a drink" — this fallback has no access to ?edit=<id>, so
          it can't know yet whether the real heading will be that or "Edit
          check-in". A neutral pulsing bar avoids flashing the wrong one. */}
      <Skeleton className="h-5 w-[150px] rounded-lg mb-2.5" />
      <Skeleton className="h-3.5 w-[220px] rounded-[7px] mb-[18px]" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="field">
          <Skeleton className="h-3 w-[60px] rounded-md mb-[7px]" />
          <Skeleton className="h-[50px] w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}
