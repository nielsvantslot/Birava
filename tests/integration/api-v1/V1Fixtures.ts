import type { V1World } from "./V1World";
import { V1World as World } from "./V1World";

/** A request to send. `token` defaults to the world's own user; null means send no credentials. */
export type FixtureRequest = {
  method?: string;
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  token?: string | null;
  /** The status a correct call answers with; defaults to the route's first 2xx response. */
  status?: number;
};

export type Fixture = {
  /** A correct call, with everything it needs created first. */
  valid: (world: V1World) => Promise<FixtureRequest>;
  /** A call the contract rejects as malformed (400, field errors). Omit only for an endpoint that takes no input. */
  invalid?: (world: V1World) => Promise<FixtureRequest>;
  /** Replaces the generic rate-limit scenario for an endpoint with its own limit (sign-in is limited per IP, not per user). */
  rateLimit?: "custom";
  /** Set to false where the same call cannot be sent twice, with the reason in notes (signing out ends the very token a repeat would use), which rules out the rate-limit and replay scenarios. */
  repeatable?: false;
  /** Why a scenario does not apply, kept next to the fixture so a gap is a decision, not an accident. */
  notes?: string;
};

const NO_SUCH_ID = "not-a-uuid";

/**
 * One entry per /api/v1 operation, keyed by operationId. The contract suite
 * (api-v1.contract.test.ts) runs the same five scenarios against every entry:
 * valid input, invalid input, unauthenticated, rate limited, idempotent
 * replay. A route without an entry here fails the suite, which is the phase 4
 * gate: an endpoint cannot ship without its contract tests.
 */
export const V1_FIXTURES: Record<string, Fixture> = {
  createToken: {
    rateLimit: "custom",
    valid: async (world) => ({ path: "/auth/token", method: "POST", token: null, body: { email: world.user.email, password: World.PASSWORD } }),
    invalid: async () => ({ path: "/auth/token", method: "POST", token: null, body: { email: 42 } }),
  },
  revokeToken: {
    valid: async () => ({ path: "/auth/token", method: "DELETE" }),
    repeatable: false,
    notes: "takes no input (the credentials are the input); a repeat has no token left to authenticate with",
  },
  logoutEverywhere: {
    valid: async () => ({ path: "/auth/logout-all", method: "POST" }),
    repeatable: false,
    notes: "takes no input; a repeat has no session left to authenticate with",
  },
  getMe: {
    valid: async () => ({ path: "/me" }),
    notes: "takes no input",
  },
  getFeed: {
    valid: async (world) => {
      await world.checkin();
      return { path: "/feed", query: { onlyOwn: "true" } };
    },
    invalid: async () => ({ path: "/feed", query: { onlyOwn: "maybe" } }),
  },
  createCheckin: {
    valid: async () => ({
      path: "/checkins",
      method: "POST",
      body: { drinkName: "Saison", drinkType: "Beer", venue: null, lat: null, lng: null, photoUrl: null, photoLqip: null },
    }),
    invalid: async () => ({ path: "/checkins", method: "POST", body: { drinkType: "Whisky", lat: 200 } }),
  },
  updateCheckin: {
    valid: async (world) => ({ path: `/checkins/${(await world.checkin()).id}`, method: "PATCH", body: { drinkName: "Stout", drinkType: "Beer" } }),
    invalid: async (world) => ({ path: `/checkins/${(await world.checkin()).id}`, method: "PATCH", body: { drinkType: "Whisky" } }),
  },
  deleteCheckin: {
    valid: async (world) => ({ path: `/checkins/${(await world.checkin()).id}`, method: "DELETE" }),
    invalid: async () => ({ path: `/checkins/${NO_SUCH_ID}`, method: "DELETE" }),
  },
  getSession: {
    valid: async (world) => ({ path: `/sessions/${(await world.checkin()).sessionId}` }),
    invalid: async () => ({ path: `/sessions/${NO_SUCH_ID}` }),
  },
  renameSession: {
    valid: async (world) => ({ path: `/sessions/${(await world.checkin()).sessionId}`, method: "PATCH", body: { name: "Friday" } }),
    invalid: async (world) => ({ path: `/sessions/${(await world.checkin()).sessionId}`, method: "PATCH", body: { name: 5 } }),
  },
  toggleCheer: {
    valid: async (world) => ({ path: `/sessions/${(await world.checkin()).sessionId}/cheer`, method: "POST" }),
    invalid: async () => ({ path: `/sessions/${NO_SUCH_ID}/cheer`, method: "POST" }),
  },
  createComment: {
    valid: async (world) => ({ path: `/sessions/${(await world.checkin()).sessionId}/comments`, method: "POST", body: { body: "Nice one" } }),
    invalid: async (world) => ({ path: `/sessions/${(await world.checkin()).sessionId}/comments`, method: "POST", body: { body: 5 } }),
  },
  deleteComment: {
    valid: async (world) => ({ path: `/comments/${(await world.comment()).id}`, method: "DELETE" }),
    invalid: async () => ({ path: `/comments/${NO_SUCH_ID}`, method: "DELETE" }),
  },
  followUser: {
    valid: async (world) => ({ path: `/users/${(await world.otherUser()).id}/follow`, method: "PUT" }),
    invalid: async () => ({ path: `/users/${NO_SUCH_ID}/follow`, method: "PUT" }),
  },
  unfollowUser: {
    valid: async (world) => ({ path: `/users/${(await world.otherUser()).id}/follow`, method: "DELETE" }),
    invalid: async () => ({ path: `/users/${NO_SUCH_ID}/follow`, method: "DELETE" }),
  },
  searchPeople: {
    valid: async (world) => ({ path: "/people", query: { q: (await world.otherUser()).username.slice(0, 4) } }),
    invalid: async () => ({ path: "/people" }),
  },
  listCrews: {
    valid: async (world) => {
      await world.crew();
      return { path: "/crews" };
    },
    notes: "takes no input",
  },
  getCrew: {
    valid: async (world) => ({ path: `/crews/${(await world.crew()).id}` }),
    invalid: async () => ({ path: `/crews/${NO_SUCH_ID}` }),
  },
  createCrew: {
    valid: async () => ({ path: "/crews", method: "POST", body: { name: "Friday crew" } }),
    invalid: async () => ({ path: "/crews", method: "POST", body: { name: 5 } }),
  },
  joinCrew: {
    valid: async (world) => ({ path: "/crews/join", method: "POST", body: { inviteCode: (await world.someoneElsesCrew()).inviteCode } }),
    invalid: async () => ({ path: "/crews/join", method: "POST", body: { inviteCode: 5 } }),
  },
  listNotifications: {
    valid: async () => ({ path: "/notifications", query: { limit: "10" } }),
    invalid: async () => ({ path: "/notifications", query: { limit: "0" } }),
  },
  markNotificationsRead: {
    valid: async () => ({ path: "/notifications/read", method: "POST" }),
    notes: "takes no input",
  },
  getOpenApiDocument: {
    valid: async () => ({ path: "/openapi.json", token: null }),
    notes: "public, read-only metadata",
  },
};
