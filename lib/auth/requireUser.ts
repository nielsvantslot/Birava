import { getCurrentUser } from "@/lib/auth/session";
import { SessionUserDTO } from "@/lib/dtos";

export function requireUser<Ctx>(
  handler: (request: Request, user: SessionUserDTO, context: Ctx) => Promise<Response>
) {
  return async (request: Request, context: Ctx): Promise<Response> => {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });
    return handler(request, user, context);
  };
}
