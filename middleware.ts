import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/auth/proxy-session";

export const runtime = "nodejs";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

// api/ is deliberately INCLUDED here (unlike a common Next.js starting
// point) — updateSession() is the only place that strips the
// x-birava-session-user trust header from an incoming request before
// possibly re-setting it. Excluding api/ from this matcher left every API
// route trusting that header completely unstripped: a request straight to
// e.g. /api/photos/[entryId] with a hand-crafted
// `x-birava-session-user: {"id":"<any-uuid>",...}` header was treated by
// getCurrentUser() (lib/auth/session.ts) as a fully authenticated session
// for that user, no cookie required — a full auth bypass. See
// updateSession()'s isApiRoute branch for why this doesn't also redirect
// API calls to the HTML /login page.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|sw.js|workbox-.*\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
