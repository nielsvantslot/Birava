import { Suspense } from "react";
import { getMyCrews } from "@/lib/controllers/groupController";
import { CreateCrewForm, JoinCrewForm } from "@/components/drink/crews-forms";
import { CrewsList } from "@/components/drink/crews-list";
import { CrewsListSkeleton } from "@/components/ui/skeleton";

// Not async: the two forms below have no server data dependency (plain
// client components), so they'd otherwise wait behind — and get
// skeleton-mimicked ahead of — a query they don't need. Only the crew list
// itself is Suspense-gated.
export default function CrewsPage() {
  return (
    <>
      <Suspense fallback={<CrewsListSkeleton />}>
        <CrewsListLoader />
      </Suspense>

      <div className="section">
        <div className="h-row" style={{ marginBottom: 6 }}>
          <h3>Start a crew</h3>
        </div>
        <p style={{ fontSize: 14, color: "var(--ink-dim)", marginBottom: 16 }}>
          Plan the trip, set the window, keep score. Everyone&apos;s ranked
          from the day they join.
        </p>
        <CreateCrewForm />
      </div>

      <div className="section">
        <div className="h-row" style={{ marginBottom: 6 }}>
          <h3>Join with a code</h3>
        </div>
        <JoinCrewForm />
      </div>
    </>
  );
}

async function CrewsListLoader() {
  const crews = await getMyCrews();

  return (
    <div className="section">
      <div className="h-row">
        <h3>Your crews</h3>
      </div>
      <CrewsList crews={crews} />
    </div>
  );
}
