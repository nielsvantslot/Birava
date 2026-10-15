import { z } from "zod";
import { ApiError } from "@/lib/gateway/ApiError";
import { ContractFields } from "@/lib/gateway/ContractFields";
import { gateway } from "@/modules/identity/server/gateway";
import { inviteCandidatesQuery } from "@/modules/crews/contract/crewContract";
import { getCrewInviteCandidates } from "@/modules/crews/server/crewReads";

// Who the viewer can invite into a crew, for the invite page's search box and
// "load more". 404 when the crew doesn't exist or the viewer can't invite.
export const GET = gateway.route.authed(
  { name: "crews.invite-candidates", params: z.object({ id: ContractFields.id }), query: inviteCandidatesQuery },
  async ({ input }) => {
    const result = await getCrewInviteCandidates({ groupId: input.params.id, ...input.query });
    if (!result) throw ApiError.notFound();
    return result;
  }
);
