import { db } from "@/lib/db";
import { SessionUserMapper } from "@/lib/mappers";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Carries the already-validated session user from middleware to the RSC render,
 * so getCurrentUser() (lib/auth/session.ts) can skip a second Session lookup for
 * the same request. Always stripped from the incoming request first so a client
 * can't spoof it.
 */
export const TRUSTED_USER_HEADER = "x-birava-session-user";

export async function updateSession(request: NextRequest) {
  const token = request.cookies.get("birava_session")?.value;

  const session = token
    ? await db.session.findUnique({
        where: { sessionToken: token },
        include: { user: true },
      })
    : null;

  const isValid = !!session && session.expiresAt.getTime() > Date.now();
  const dto = isValid ? SessionUserMapper.toDTO(session.user) : null;

  const url = request.nextUrl.clone();
  const isAuthPage =
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/signup");

  if (!dto && !isAuthPage) {
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (dto && isAuthPage) {
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(TRUSTED_USER_HEADER);
  if (dto) {
    requestHeaders.set(TRUSTED_USER_HEADER, JSON.stringify(dto));
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}
