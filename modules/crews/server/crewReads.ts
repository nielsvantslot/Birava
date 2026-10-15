import { getCurrentUser } from "@/modules/identity/server/session";
import { getCrewSummariesForUser, getCrewDetailForViewer, type CrewSummary, type CrewDetail } from "@/modules/crews/server/groupQueries";
import { getCrewInviteCandidates as getCrewInviteCandidatesQuery } from "@/modules/crews/server/groupInviteQueries";
import type { GetCrewDTO, GetCrewInviteCandidatesDTO } from "@/lib/dtos";

// Reads for pages and the invite-candidates GET route. Deliberately not Server
// Actions: every export of a "use server" file is a public POST endpoint, and a
// read has no business being one.

/** Who the current user can invite into a crew — null if they can't invite at all right now. */
export async function getCrewInviteCandidates(input: GetCrewInviteCandidatesDTO) {
  const user = await getCurrentUser();
  if (!user) return null;

  return getCrewInviteCandidatesQuery(user.id, input.groupId, {
    search: input.search,
    offset: input.offset,
  });
}

/** The current user's crews with their rank in each (one bulk read, no N+1). */
export async function getMyCrews(): Promise<CrewSummary[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  return getCrewSummariesForUser(user.id);
}

/** A crew's board — null when the crew doesn't exist or the viewer isn't a member. */
export async function getCrew(input: GetCrewDTO): Promise<CrewDetail | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  return getCrewDetailForViewer(input.crewId, user.id);
}
