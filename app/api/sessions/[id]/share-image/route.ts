import { z } from "zod";
import { ApiError } from "@/lib/gateway/ApiError";
import { gateway } from "@/modules/identity/server/gateway";
import { canRenderShareImage, getShareImageForSession } from "@/modules/sessions";

// Prisma (getCurrentUser / history) and the storage layer need Node, not edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = gateway.route.authed(
  { name: "sessions.share-image", params: z.object({ id: z.string().min(1) }) },
  async ({ user, input }) => {
    const { id } = input.params;

    // Ownership check first, with a cheap owner-id-only lookup. The cache-hit
    // path (inside getShareImageForSession) needs nothing more than "does the
    // caller own this session?", so defer the full session+check-ins load until
    // a confirmed cache miss actually requires it to render. getSession is only
    // login-gated, so the own-only rule is enforced explicitly here (a
    // mismatched or missing owner both 404); the client falls back to a text
    // share on 404.
    if (!(await canRenderShareImage(user.id, id))) {
      throw ApiError.notFound();
    }

    const dto = await getShareImageForSession(id);
    if (!dto) {
      throw ApiError.notFound();
    }
    return dto;
  }
);
