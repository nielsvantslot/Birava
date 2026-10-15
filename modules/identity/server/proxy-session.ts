import { SessionUserDTO } from "@/lib/dtos";
import { SessionResolver } from "@/modules/identity/application/SessionResolver";
import { sessionRepository } from "@/modules/identity/server/sessionRepository";
import { NextResponse, type NextRequest } from "next/server";
import { ContentSecurityPolicyBuilder } from "@/lib/security/ContentSecurityPolicyBuilder";
import { RequestContext } from "@/lib/logging/RequestContext";

const sessionResolver = new SessionResolver(sessionRepository);

/** Exported for direct testing — updateSession() is the only production caller. The caching and its trade-offs are explained on SessionResolver. */
export async function resolveSessionUser(token: string): Promise<SessionUserDTO | null> {
  return sessionResolver.resolve(token);
}

/** Forgets a revoked token (or all tokens) in this instance's cache. */
export function evictSessionUser(token?: string): void {
  sessionResolver.evict(token);
}

export async function updateSession(request: NextRequest) {
  const token = request.cookies.get("birava_session")?.value;

  const dto = token ? await resolveSessionUser(token) : null;
  const { nonce, headerValue: csp } = ContentSecurityPolicyBuilder.build();

  const url = request.nextUrl.clone();
  const isAuthPage =
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/signup");
  // The service worker's offline fallback (public/sw.js) must render for
  // whoever hits it, logged in or not, or offline visitors with no session
  // cookie yet would get redirected straight into a login page that itself
  // can't load without a network.
  const isOfflinePage = url.pathname === "/offline";
  // API routes are matched now (see middleware.ts's matcher comment) purely
  // so the trust-header strip/set below still runs for them — they must
  // never hit the page-redirect branches: a fetch() caller expecting a JSON
  // 401 from getCurrentUser() returning null would instead transparently
  // follow a redirect into the /login page's HTML and fail to parse it as
  // JSON. Each API route already handles "no user" itself.
  const isApiRoute = url.pathname.startsWith("/api/");

  if (!isApiRoute) {
    if (!dto && !isAuthPage && !isOfflinePage) {
      url.pathname = "/login";
      const response = NextResponse.redirect(url);
      response.headers.set("Content-Security-Policy", csp);
      return response;
    }

    if (dto && isAuthPage) {
      url.pathname = "/dashboard";
      const response = NextResponse.redirect(url);
      response.headers.set("Content-Security-Policy", csp);
      return response;
    }
  }

  const requestId = RequestContext.resolve(request.headers.get(RequestContext.HEADER));
  const requestHeaders = new Headers(request.headers);
  // Defence in depth: nothing reads this header any more, but never let a client-supplied one travel on.
  requestHeaders.delete("x-birava-session-user");
  requestHeaders.set(RequestContext.HEADER, requestId);
  // Forwarded so Next's own renderer can pick the nonce back up and stamp it
  // onto the framework's inline hydration/RSC-streaming scripts — see
  // ContentSecurityPolicyBuilder's doc comment.
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set(RequestContext.HEADER, requestId);
  return response;
}
