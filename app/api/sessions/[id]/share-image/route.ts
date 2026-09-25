import { requireUser } from "@/lib/auth/requireUser";
import { canRenderShareImage, getShareImageForSession } from "@/lib/commands/shareImageCommands";

// Prisma (getCurrentUser / history) and the storage layer need Node, not edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = requireUser<RouteContext<"/api/sessions/[id]/share-image">>(
  async (_request, user, { params }) => {
    const { id } = await params;

    // Ownership check first, with a cheap owner-id-only lookup. The cache-hit
    // path (inside getShareImageForSession) needs nothing more than "does the
    // caller own this session?", so defer the full session+check-ins load until
    // a confirmed cache miss actually requires it to render. getSession is only
    // login-gated, so the own-only rule is enforced explicitly here (a
    // mismatched or missing owner both 404); the client falls back to a text
    // share on 404.
    if (!(await canRenderShareImage(user.id, id))) {
      return new Response("Not found", { status: 404 });
    }

    const dto = await getShareImageForSession(id);
    if (!dto) {
      return new Response("Not found", { status: 404 });
    }
    return Response.json(dto);
  }
);
