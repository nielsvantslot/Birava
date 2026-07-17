import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
  return (
    <div className="section">
      {[...Array(6)].map((_, i) => (
        <div className="row" key={i}>
          <div className="rowmark">
            <Skeleton className="h-full w-full rounded-full" />
          </div>
          <div className="grow space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
