import { gateway } from "@/modules/identity/server/gateway";
import { searchPeopleQuery } from "@/modules/identity/contract/peopleContract";
import { searchUsers } from "@/modules/social/server/socialReads";

// Find people by username, for the people page's search box.
export const GET = gateway.route.authed({ name: "people.search", query: searchPeopleQuery }, ({ input }) =>
  searchUsers({ query: input.query.q })
);
