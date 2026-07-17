import { Skeleton } from "@/components/ui/skeleton";

export default function PeopleLoading() {
  return (
    <div className="section">
      <div className="h-row" style={{ marginBottom: 6 }}>
        <h3>Find people</h3>
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}
