import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getCrew } from "@/lib/controllers/groupController";
import {
  LeaveCrewButton,
  CloseCrewButton,
  DeleteCrewButton,
  RenameCrewForm,
  RegenerateInviteCodeButton,
  CopyCodeChip,
} from "@/components/drink/crews-forms";
import { CrewSettingsPanel } from "@/components/drink/crew-settings";

/**
 * Everything about managing a crew, consolidated off the main crew detail
 * page: identity (name/code), visibility, member roles/kicking, invites,
 * and leave/close/delete. Every member can reach this (to invite or leave);
 * owner/admin-only actions gate themselves internally.
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

      {isOwner && <RenameCrewForm crewId={crew.id} name={crew.name} />}

      {/* A closed crew stops accepting new members (joinGroup/sendCrewInvite
          both block it), so there's nothing to invite with or into. */}
      {canInvite && !isClosed && (
        <>
          <div className="section">
            <div className="h-row" style={{ marginBottom: 10 }}>
              <h3>Invite code</h3>
            </div>
            <div style={{ marginBottom: isOwner ? 12 : 0 }}>
              <CopyCodeChip code={crew.inviteCode} />
            </div>
            {isOwner && <RegenerateInviteCodeButton crewId={crew.id} />}
          </div>

          <div className="section">
            <Link href={`/crews/${crew.id}/invite`} className="row">
              <div className="rowmark">
                <svg viewBox="0 0 24 24">
                  <circle cx="9" cy="8" r="4"></circle>
                  <path d="M2 21c0-4 3-6 7-6 1.2 0 2.3.15 3.2.5"></path>
                  <path d="M17 14v6M14 17h6"></path>
                </svg>
              </div>
              <div className="grow">
                <b>Invite people</b>
                <span>Search mutual follows and send an invite</span>
              </div>
              <span className="chev">›</span>
            </Link>
          </div>
        </>
      )}

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
