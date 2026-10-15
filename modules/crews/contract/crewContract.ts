import { z } from "zod";
import { ContractFields } from "@/lib/gateway/ContractFields";

const { id } = ContractFields;

/** `createGroup`. The 2 to 50 character rule lives in the command; this only bounds absurd input. */
export const createCrewInput = z.object({ name: z.string().max(500) });

/** `joinGroupByInvite`. Codes are short; a longer value can never match, so it is cut off here. */
export const joinCrewInput = z.object({ inviteCode: z.string().max(64) });

/** Actions that only name the crew: leave, regenerate the invite code, close, delete. */
export const crewIdInput = z.object({ groupId: id });

export const setCrewVisibilityInput = z.object({ groupId: id, visibility: z.enum(["PUBLIC", "PRIVATE"]) });

export const renameCrewInput = z.object({ groupId: id, name: z.string().max(500) });

export const setMemberRoleInput = z.object({ groupId: id, userId: id, role: z.enum(["ADMIN", "MEMBER"]) });

/** Kicking and unbanning both name a crew and a member. */
export const crewMemberInput = z.object({ groupId: id, userId: id });

export const sendCrewInviteInput = z.object({ groupId: id, invitedUserId: id });

export const respondToCrewInviteInput = z.object({ inviteId: id, accept: z.boolean() });

/** `GET /api/crews/[id]/invite-candidates`. */
export const inviteCandidatesQuery = z.object({
  search: z.string().max(100).optional(),
  offset: z.coerce.number().int().min(0).max(10_000).optional(),
});
