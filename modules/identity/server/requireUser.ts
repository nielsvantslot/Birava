import { getCurrentUser } from "@/modules/identity/server/session";
import { SessionUserDTO } from "@/lib/dtos";
import { LoggerFactory } from "@/lib/logging/LoggerFactory";

const logger = LoggerFactory.create("api");

export function requireUser<Ctx>(
  handler: (request: Request, user: SessionUserDTO, context: Ctx) => Promise<Response>
) {
  return async (request: Request, context: Ctx): Promise<Response> => {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });
    try {
      return await handler(request, user, context);
    } catch (error) {
      // Logged with the request id, then rethrown so Next still returns its 500.
      logger.error("route handler threw", { userId: user.id, url: new URL(request.url).pathname, error });
      throw error;
    }
  };
}
