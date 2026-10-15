import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import { ApiError } from "@/lib/gateway/ApiError";
import { addDrink, deleteDrink, editDrink, renameSession } from "@/modules/checkins/actions/drinkController";
import { createCheckinInput, deleteCheckinInput, feedQuery, updateCheckinInput } from "@/modules/checkins/contract/checkinContract";
import { getMyFeedSessions, getSession } from "@/modules/checkins/server/drinkReads";
import { renameSessionInput } from "@/modules/sessions/contract/sessionContract";
import type { V1Guards } from "../V1Guards";
import type { V1Env } from "../V1Services";
import { V1Responses, feedPageSchema, idParam, sessionSchema } from "../V1Schemas";
import { V1Result } from "../V1Result";
import { V1Security, type V1Route } from "../V1Route";

const createdSchema = z.object({ id: z.string(), achievementUnlocked: z.boolean() });
const okSchema = z.object({});

/** Check-ins, the feed and sessions. */
export class CheckinRoutes {
  static register(app: OpenAPIHono<V1Env>, guards: V1Guards): V1Route[] {
    const getFeed = V1Security.any(createRoute({
      method: "get",
      path: "/feed",
      operationId: "getFeed",
      tags: ["feed"],
      summary: "One page of the feed: your sessions, or yours and everyone you follow",
      request: { query: feedQuery },
      middleware: [guards.requireUser],
      responses: { 200: { description: "A page of sessions", content: { "application/json": { schema: feedPageSchema } } }, ...V1Responses.errors(400, 401) },
    }));
    app.openapi(getFeed, async (c) => c.json(feedPageSchema.parse(await getMyFeedSessions(c.req.valid("query"))), 200));

    const createCheckin = V1Security.any(createRoute({
      method: "post",
      path: "/checkins",
      operationId: "createCheckin",
      tags: ["checkins"],
      summary: "Log a drink. Retrying with the same clientId (or an Idempotency-Key) never creates a second one",
      request: { body: { required: true, content: { "application/json": { schema: createCheckinInput } } } },
      middleware: [guards.requireUser],
      responses: { 201: { description: "Logged", content: { "application/json": { schema: createdSchema } } }, ...V1Responses.errors(400, 401, 409, 429) },
    }));
    app.openapi(createCheckin, async (c) => {
      const result = V1Result.unwrap(await addDrink(c.req.valid("json")));
      return c.json({ id: result.id ?? "", achievementUnlocked: result.achievementUnlocked ?? false }, 201);
    });

    const updateCheckin = V1Security.any(createRoute({
      method: "patch",
      path: "/checkins/{id}",
      operationId: "updateCheckin",
      tags: ["checkins"],
      summary: "Edit one of your check-ins",
      request: {
        params: idParam,
        body: { required: true, content: { "application/json": { schema: updateCheckinInput.omit({ id: true }) } } },
      },
      middleware: [guards.requireUser],
      responses: { 200: { description: "Updated", content: { "application/json": { schema: okSchema } } }, ...V1Responses.errors(400, 401, 403, 404, 409, 429) },
    }));
    app.openapi(updateCheckin, async (c) => {
      V1Result.assertOk(await editDrink({ id: c.req.valid("param").id, ...c.req.valid("json") }));
      return c.json({}, 200);
    });

    const deleteCheckin = V1Security.any(createRoute({
      method: "delete",
      path: "/checkins/{id}",
      operationId: "deleteCheckin",
      tags: ["checkins"],
      summary: "Delete one of your check-ins",
      request: { params: idParam },
      middleware: [guards.requireUser],
      responses: { 204: { description: "Deleted" }, ...V1Responses.errors(400, 401, 404, 409, 429) },
    }));
    app.openapi(deleteCheckin, async (c) => {
      V1Result.assertOk(await deleteDrink(deleteCheckinInput.parse({ id: c.req.valid("param").id })));
      return c.body(null, 204);
    });

    const getSessionRoute = V1Security.any(createRoute({
      method: "get",
      path: "/sessions/{id}",
      operationId: "getSession",
      tags: ["sessions"],
      summary: "One session with its check-ins",
      request: { params: idParam },
      middleware: [guards.requireUser],
      responses: { 200: { description: "The session", content: { "application/json": { schema: sessionSchema } } }, ...V1Responses.errors(400, 401, 404) },
    }));
    app.openapi(getSessionRoute, async (c) => {
      const session = await getSession({ id: c.req.valid("param").id });
      if (!session) throw ApiError.notFound("Session not found");
      return c.json(sessionSchema.parse(session), 200);
    });

    const renameSessionRoute = V1Security.any(createRoute({
      method: "patch",
      path: "/sessions/{id}",
      operationId: "renameSession",
      tags: ["sessions"],
      summary: "Give one of your sessions a name (null clears it)",
      request: { params: idParam, body: { required: true, content: { "application/json": { schema: renameSessionInput.omit({ id: true }) } } } },
      middleware: [guards.requireUser],
      responses: { 200: { description: "Renamed", content: { "application/json": { schema: okSchema } } }, ...V1Responses.errors(400, 401, 404, 409, 429) },
    }));
    app.openapi(renameSessionRoute, async (c) => {
      V1Result.assertOk(await renameSession({ id: c.req.valid("param").id, ...c.req.valid("json") }));
      return c.json({}, 200);
    });

    return [
      { operationId: "getFeed", route: getFeed, authenticated: true, mutating: false },
      { operationId: "createCheckin", route: createCheckin, authenticated: true, mutating: true },
      { operationId: "updateCheckin", route: updateCheckin, authenticated: true, mutating: true },
      { operationId: "deleteCheckin", route: deleteCheckin, authenticated: true, mutating: true },
      { operationId: "getSession", route: getSessionRoute, authenticated: true, mutating: false },
      { operationId: "renameSession", route: renameSessionRoute, authenticated: true, mutating: true },
    ];
  }
}
