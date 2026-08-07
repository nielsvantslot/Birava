"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setCrewVisibility,
  setMemberRole,
  kickMember,
  unbanMember,
} from "@/lib/controllers/groupController";
import { showToast } from "@/components/ui/toast-pill";
import { confirmModal } from "@/components/ui/confirm-modal";
import { avatarSrc } from "@/lib/utils";
import { invalidateCachedPages } from "@/lib/swCache";

type CrewRole = "OWNER" | "ADMIN" | "MEMBER";

type CrewMemberInfo = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  role: CrewRole;
};

type BannedCrewMember = {
  userId: string;
  username: string;
  avatarUrl: string | null;
};

type ActionResult = { error?: string; revalidatedPaths?: string[] };

/**
 * Owner/admin-only crew management: visibility, member roles, kicking, and
 * lifting a previous kick. Renders nothing for a plain member.
 */
export function CrewSettingsPanel({
  crewId,
  visibility,
  viewerRole,
  viewerId,
  members,
  bannedMembers,
}: {
  crewId: string;
  visibility: "PUBLIC" | "PRIVATE";
  viewerRole: CrewRole;
  viewerId: string;
  members: CrewMemberInfo[];
  bannedMembers: BannedCrewMember[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const isOwner = viewerRole === "OWNER";
  const isAdmin = viewerRole === "ADMIN";
  if (!isOwner && !isAdmin) return null;

  const run = (key: string, action: () => Promise<ActionResult>) => {
    setBusyKey(key);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        showToast(result.error);
      } else {
        invalidateCachedPages([...(result.revalidatedPaths ?? []), `/crews/${crewId}`]);
      }
      setBusyKey(null);
      router.refresh();
    });
  };

  const otherMembers = members.filter((m) => m.userId !== viewerId && m.role !== "OWNER");

  return (
    <div className="section">
      <div className="h-row" style={{ marginBottom: 6 }}>
        <h3>Crew settings</h3>
      </div>

      {isOwner && (
        <div className="switch-row" style={{ marginBottom: 10 }}>
          <div className="grow">
            <b>Private crew</b>
            <p>Only you and admins can share the invite code.</p>
          </div>
          <button
            role="switch"
            aria-checked={visibility === "PRIVATE"}
            aria-label="Private crew"
            className={`switch${visibility === "PRIVATE" ? " on" : ""}`}
            disabled={busyKey === "visibility"}
            onClick={() =>
              run("visibility", () =>
                setCrewVisibility({
                  groupId: crewId,
                  visibility: visibility === "PRIVATE" ? "PUBLIC" : "PRIVATE",
                })
              )
            }
          />
        </div>
      )}

      {otherMembers.map((m) => {
        const canKick = isOwner || (isAdmin && m.role === "MEMBER");
        return (
          <div className="row" key={m.userId} style={{ padding: "10px 0" }}>
            <div className="avatar">
              {m.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarSrc(m.userId)} alt={m.username} />
              ) : (
                m.username.slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="grow">
              <b>{m.username}</b>
              <span>{m.role === "ADMIN" ? "Admin" : "Member"}</span>
            </div>
            {isOwner && (
              <button
                className="btn btn-ghost"
                style={{ marginRight: 8 }}
                disabled={busyKey === `role-${m.userId}`}
                onClick={() =>
                  run(`role-${m.userId}`, () =>
                    setMemberRole({
                      groupId: crewId,
                      userId: m.userId,
                      role: m.role === "ADMIN" ? "MEMBER" : "ADMIN",
                    })
                  )
                }
              >
                {m.role === "ADMIN" ? "Demote" : "Make admin"}
              </button>
            )}
            {canKick && (
              <button
                className="btn btn-ghost"
                disabled={busyKey === `kick-${m.userId}`}
                onClick={async () => {
                  const confirmed = await confirmModal({
                    title: "Remove member?",
                    message: `${m.username} will need a fresh invite to rejoin.`,
                    confirmLabel: "Remove",
                    danger: true,
                  });
                  if (!confirmed) return;
                  run(`kick-${m.userId}`, () => kickMember({ groupId: crewId, userId: m.userId }));
                }}
              >
                Remove
              </button>
            )}
          </div>
        );
      })}

      {isOwner && bannedMembers.length > 0 && (
        <>
          <div className="h-row" style={{ marginTop: 16, marginBottom: 6 }}>
            <h3>Removed</h3>
          </div>
          {bannedMembers.map((b) => (
            <div className="row" key={b.userId} style={{ padding: "10px 0" }}>
              <div className="avatar">
                {b.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarSrc(b.userId)} alt={b.username} />
                ) : (
                  b.username.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="grow">
                <b>{b.username}</b>
              </div>
              <button
                className="btn btn-ghost"
                disabled={busyKey === `unban-${b.userId}`}
                onClick={() => run(`unban-${b.userId}`, () => unbanMember({ groupId: crewId, userId: b.userId }))}
              >
                Unban
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
