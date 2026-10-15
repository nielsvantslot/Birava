import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import { ApiError } from "@/lib/gateway/ApiError";
import { createGroup, joinGroupByInvite } from "@/modules/crews/actions/groupController";
import { createCrewInput, joinCrewInput } from "@/modules/crews/contract/crewContract";
import { getCrew, getMyCrews } from "@/modules/crews/server/crewReads";
import type { V1Guards } from "../V1Guards";
import type { V1Env } from "../V1Services";
import { V1Responses, idParam } from "../V1Schemas";
import { V1Result } from "../V1Result";
import { V1Security, type V1Route } from "../V1Route";

const crewSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  inviteCode: z.string(),
  memberCount: z.number(),
  rank: z.number().nullable(),
  closed: z.boolean(),
});

/** The full board: members, scores and recent sessions. The nested lists are documented by example in the guide, not field by field here. */
const crewDetailSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  inviteCode: z.string(),
  createdAt: z.string(),
  closedAt: z.string().nullable(),
  ownerId: z.string(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
  viewerRole: z.string(),
  memberCount: z.number(),
  members: z.array(z.looseObject({ userId: z.string(), username: z.string() })),
  scores: z.array(z.looseObject({ userId: z.string(), sessions: z.number(), drinks: z.number() })),
});

/** Crews. Leaderboards score each member since they joined. */
export class CrewRoutes {
  static register(app: OpenAPIHono<V1Env>, guards: V1Guards): V1Route[] {
    const list = V1Security.any(createRoute({
      method: "get",
      path: "/crews",
      operationId: "listCrews",
      tags: ["crews"],
      summary: "Your crews, with your rank in each",
      middleware: [guards.requireUser],
      responses: { 200: { description: "Your crews", content: { "application/json": { schema: z.array(crewSummarySchema) } } }, ...V1Responses.errors(401) },
    }));
    app.openapi(list, async (c) => c.json(z.array(crewSummarySchema).parse(await getMyCrews()), 200));

    const detail = V1Security.any(createRoute({
      method: "get",
      path: "/crews/{id}",
      operationId: "getCrew",
      tags: ["crews"],
      summary: "One crew's board. 404 when it does not exist or you are not a member",
      request: { params: idParam },
      middleware: [guards.requireUser],
      responses: { 200: { description: "The crew", content: { "application/json": { schema: crewDetailSchema } } }, ...V1Responses.errors(400, 401, 404) },
    }));
    app.openapi(detail, async (c) => {
      const crew = await getCrew({ crewId: c.req.valid("param").id });
      if (!crew) throw ApiError.notFound("Crew not found");
      return c.json(crewDetailSchema.parse(crew), 200);
    });

    const create = V1Security.any(createRoute({
      method: "post",
      path: "/crews",
      operationId: "createCrew",
      tags: ["crews"],
      summary: "Start a crew. You are its owner; share the invite code",
      request: { body: { required: true, content: { "application/json": { schema: createCrewInput } } } },
      middleware: [guards.requireUser],
      responses: { 201: { description: "Created", content: { "application/json": { schema: z.object({ inviteCode: z.string() }) } } }, ...V1Responses.errors(400, 401, 409, 429) },
    }));
    app.openapi(create, async (c) => {
      const result = V1Result.unwrap(await createGroup(c.req.valid("json")));
      return c.json({ inviteCode: result.inviteCode ?? "" }, 201);
    });

    const join = V1Security.any(createRoute({
      method: "post",
      path: "/crews/join",
      operationId: "joinCrew",
      tags: ["crews"],
      summary: "Join a crew with its invite code. 404 when the code matches no crew",
      request: { body: { required: true, content: { "application/json": { schema: joinCrewInput } } } },
      middleware: [guards.requireUser],
      responses: { 200: { description: "Joined", content: { "application/json": { schema: z.object({ groupName: z.string() }) } } }, ...V1Responses.errors(400, 401, 404, 409, 429) },
    }));
    app.openapi(join, async (c) => {
      const result = V1Result.unwrap(await joinGroupByInvite(c.req.valid("json")));
      return c.json({ groupName: result.groupName ?? "" }, 200);
    });

    return [
      { operationId: "listCrews", route: list, authenticated: true, mutating: false },
      { operationId: "getCrew", route: detail, authenticated: true, mutating: false },
      { operationId: "createCrew", route: create, authenticated: true, mutating: true },
      { operationId: "joinCrew", route: join, authenticated: true, mutating: true },
    ];
  }
}
