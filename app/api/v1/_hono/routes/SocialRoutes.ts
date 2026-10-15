import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import { ApiError } from "@/lib/gateway/ApiError";
import { createComment, deleteComment, followUser, toggleCheer, unfollowUser } from "@/modules/social/actions/socialController";
import { createCommentInput } from "@/modules/social/contract/socialContract";
import { searchPeopleQuery } from "@/modules/identity/contract/peopleContract";
import { searchUsers } from "@/modules/social/server/socialReads";
import type { V1Guards } from "../V1Guards";
import type { V1Env } from "../V1Services";
import { V1Responses, idParam, userSummarySchema } from "../V1Schemas";
import { V1Result } from "../V1Result";
import { V1Security, type V1Route } from "../V1Route";

const commentSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  userId: z.string(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
  isDeveloper: z.boolean(),
  body: z.string(),
  createdAt: z.string(),
});

const cheerSchema = z.object({ on: z.boolean(), count: z.number() });

/** Cheers, comments, following and finding people. */
export class SocialRoutes {
  static register(app: OpenAPIHono<V1Env>, guards: V1Guards): V1Route[] {
    const cheer = V1Security.any(createRoute({
      method: "post",
      path: "/sessions/{id}/cheer",
      operationId: "toggleCheer",
      tags: ["social"],
      summary: "Cheer a session, or take your cheer back",
      request: { params: idParam },
      middleware: [guards.requireUser],
      responses: { 200: { description: "Your cheer state now", content: { "application/json": { schema: cheerSchema } } }, ...V1Responses.errors(400, 401, 404, 409, 429) },
    }));
    app.openapi(cheer, async (c) => {
      const result = V1Result.unwrap(await toggleCheer({ sessionId: c.req.valid("param").id }));
      return c.json({ on: result.on ?? false, count: result.count ?? 0 }, 200);
    });

    const comment = V1Security.any(createRoute({
      method: "post",
      path: "/sessions/{id}/comments",
      operationId: "createComment",
      tags: ["social"],
      summary: "Comment on a session",
      request: { params: idParam, body: { required: true, content: { "application/json": { schema: createCommentInput.omit({ sessionId: true }) } } } },
      middleware: [guards.requireUser],
      responses: { 201: { description: "Posted", content: { "application/json": { schema: z.object({ comment: commentSchema }) } } }, ...V1Responses.errors(400, 401, 404, 409, 429) },
    }));
    app.openapi(comment, async (c) => {
      const result = V1Result.unwrap(await createComment({ sessionId: c.req.valid("param").id, ...c.req.valid("json") }));
      if (!result.comment) throw ApiError.validation("The comment could not be posted.");
      return c.json({ comment: commentSchema.parse(result.comment) }, 201);
    });

    const removeComment = V1Security.any(createRoute({
      method: "delete",
      path: "/comments/{id}",
      operationId: "deleteComment",
      tags: ["social"],
      summary: "Delete one of your comments",
      request: { params: idParam },
      middleware: [guards.requireUser],
      responses: { 204: { description: "Deleted" }, ...V1Responses.errors(400, 401, 403, 404, 409, 429) },
    }));
    app.openapi(removeComment, async (c) => {
      V1Result.assertOk(await deleteComment({ commentId: c.req.valid("param").id }));
      return c.body(null, 204);
    });

    const follow = V1Security.any(createRoute({
      method: "put",
      path: "/users/{id}/follow",
      operationId: "followUser",
      tags: ["social"],
      summary: "Follow someone (following again changes nothing)",
      request: { params: idParam },
      middleware: [guards.requireUser],
      responses: { 204: { description: "Following" }, ...V1Responses.errors(400, 401, 409, 429) },
    }));
    app.openapi(follow, async (c) => {
      V1Result.assertOk((await followUser({ targetUserId: c.req.valid("param").id })) ?? {});
      return c.body(null, 204);
    });

    const unfollow = V1Security.any(createRoute({
      method: "delete",
      path: "/users/{id}/follow",
      operationId: "unfollowUser",
      tags: ["social"],
      summary: "Stop following someone",
      request: { params: idParam },
      middleware: [guards.requireUser],
      responses: { 204: { description: "Not following" }, ...V1Responses.errors(400, 401, 409, 429) },
    }));
    app.openapi(unfollow, async (c) => {
      V1Result.assertOk((await unfollowUser({ targetUserId: c.req.valid("param").id })) ?? {});
      return c.body(null, 204);
    });

    const search = V1Security.any(createRoute({
      method: "get",
      path: "/people",
      operationId: "searchPeople",
      tags: ["social"],
      summary: "Find people by username",
      request: { query: searchPeopleQuery },
      middleware: [guards.requireUser],
      responses: { 200: { description: "Matches", content: { "application/json": { schema: z.array(userSummarySchema) } } }, ...V1Responses.errors(400, 401) },
    }));
    app.openapi(search, async (c) => c.json(z.array(userSummarySchema).parse(await searchUsers({ query: c.req.valid("query").q })), 200));

    return [
      { operationId: "toggleCheer", route: cheer, authenticated: true, mutating: true },
      { operationId: "createComment", route: comment, authenticated: true, mutating: true },
      { operationId: "deleteComment", route: removeComment, authenticated: true, mutating: true },
      { operationId: "followUser", route: follow, authenticated: true, mutating: true },
      { operationId: "unfollowUser", route: unfollow, authenticated: true, mutating: true },
      { operationId: "searchPeople", route: search, authenticated: true, mutating: false },
    ];
  }
}
