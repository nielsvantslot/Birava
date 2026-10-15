import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import { markNotificationsRead } from "@/modules/notifications/actions/notificationController";
import { getMyNotifications } from "@/modules/notifications/server/notificationReads";
import type { V1Guards } from "../V1Guards";
import type { V1Env } from "../V1Services";
import { V1Responses } from "../V1Schemas";
import { V1Result } from "../V1Result";
import { V1Security, type V1Route } from "../V1Route";

const notificationSchema = z.object({
  id: z.string(),
  type: z.string(),
  message: z.string(),
  href: z.string(),
  actorId: z.string().nullable(),
  actorAvatarUrl: z.string().nullable(),
  read: z.boolean(),
  createdAt: z.string(),
  inviteId: z.string().nullable(),
});

const notificationsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(30),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

/** The in-app notification list. */
export class NotificationRoutes {
  static register(app: OpenAPIHono<V1Env>, guards: V1Guards): V1Route[] {
    const list = V1Security.any(createRoute({
      method: "get",
      path: "/notifications",
      operationId: "listNotifications",
      tags: ["notifications"],
      summary: "Your notifications, newest first",
      request: { query: notificationsQuery },
      middleware: [guards.requireUser],
      responses: { 200: { description: "A page of notifications", content: { "application/json": { schema: z.array(notificationSchema) } } }, ...V1Responses.errors(400, 401) },
    }));
    app.openapi(list, async (c) => c.json(z.array(notificationSchema).parse(await getMyNotifications(c.req.valid("query"))), 200));

    const markRead = V1Security.any(createRoute({
      method: "post",
      path: "/notifications/read",
      operationId: "markNotificationsRead",
      tags: ["notifications"],
      summary: "Mark every notification read",
      middleware: [guards.requireUser],
      responses: { 204: { description: "Marked read" }, ...V1Responses.errors(401, 409, 429) },
    }));
    app.openapi(markRead, async (c) => {
      V1Result.assertOk((await markNotificationsRead()) ?? {});
      return c.body(null, 204);
    });

    return [
      { operationId: "listNotifications", route: list, authenticated: true, mutating: false },
      { operationId: "markNotificationsRead", route: markRead, authenticated: true, mutating: true },
    ];
  }
}
