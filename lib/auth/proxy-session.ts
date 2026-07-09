import { db } from "@/lib/db";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const token = request.cookies.get("birava_session")?.value;

  const session = token
    ? await db.session.findUnique({
        where: { sessionToken: token },
        select: { expiresAt: true },
      })
    : null;

  const user =
    session && session.expiresAt.getTime() > Date.now()
      ? { id: "authenticated" }
      : null;

  const url = request.nextUrl.clone();
  const isAuthPage =
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/signup") ||
    url.pathname.startsWith("/forgot-password") ||
    url.pathname.startsWith("/reset-password");

  if (!user && !isAuthPage) {
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}
