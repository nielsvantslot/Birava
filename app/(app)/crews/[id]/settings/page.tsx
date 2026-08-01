import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getCrew } from "@/lib/controllers/groupController";
import { LeaveCrewButton, CloseCrewButton, DeleteCrewButton } from "@/components/drink/crews-forms";
import { CrewSettingsPanel } from "@/components/drink/crew-settings";
import { CrewInvitePanel } from "@/components/drink/crew-invite-panel";

/**
 * Everything about managing a crew, consolidated off the main crew detail
 * page: visibility, member roles/kicking, invites, and leave/close/delete.
 * Every member can reach this (to invite or leave); owner/admin-only actions
 * gate themselves internally.
 */
export default async function CrewSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { id } = await params;
  const crew = await getCrew({ crewId: id });
  if (!crew) notFound();

  const isOwner = crew.ownerId === user.id;
  const isClosed = !!crew.closedAt;
  // Same rule gates sharing the invite code and sending an in-app invite —
  // any member when PUBLIC, owner/admin only when PRIVATE (#162).
  const canInvite = crew.visibility === "PUBLIC" || crew.viewerRole !== "MEMBER";

  return (
    <>
      <div className="section flush" style={{ padding: "20px 16px 16px" }}>
        <h1
          style={{
            fontFamily: "var(--serif)",
            fontSize: 22,
            fontWeight: 600,
          }}
        >
          {crew.name}
        </h1>
        <p style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 3 }}>
          Crew settings
        </p>
      </div>

      {canInvite && <CrewInvitePanel crewId={crew.id} />}

      <CrewSettingsPanel
        crewId={crew.id}
        visibility={crew.visibility}
        viewerRole={crew.viewerRole}
        viewerId={user.id}
        members={crew.members}
        bannedMembers={crew.bannedMembers}
      />

      {!isOwner && (
        <div className="section">
          <LeaveCrewButton crewId={crew.id} />
        </div>
      )}

      {isOwner && (
        <div className="section" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {!isClosed && <CloseCrewButton crewId={crew.id} />}
          <DeleteCrewButton crewId={crew.id} crewName={crew.name} />
        </div>
      )}
    </>
  );
}
