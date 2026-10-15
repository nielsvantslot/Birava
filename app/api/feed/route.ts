import { gateway } from "@/modules/identity/server/gateway";
import { getMyFeedSessions } from "@/modules/checkins/server/drinkReads";
import { feedQuery } from "@/modules/checkins/contract/checkinContract";

// One page of the dashboard feed, for the client's infinite scroll. The first
// page is rendered on the server by the dashboard page with the same function.
export const GET = gateway.route.authed({ name: "feed.get", query: feedQuery }, ({ input }) => getMyFeedSessions(input.query));
