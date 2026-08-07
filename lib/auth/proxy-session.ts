import { db } from "@/lib/db";
import { SessionUserMapper } from "@/lib/mappers";
import { SessionUserDTO } from "@/lib/dtos";
import { NextResponse, type NextRequest } from "next/server";
import { ContentSecurityPolicyBuilder } from "@/lib/security/ContentSecurityPolicyBuilder";

/**
 * Carries the already-validated session user from middleware to the RSC render,
 * so getCurrentUser() (lib/auth/session.ts) can skip a second Session lookup for
 * the same request. Always stripped from the incoming request first so a client
 * can't spoof it.
 */
export const TRUSTED_USER_HEADER = "x-birava-session-user";

// Every matched navigation pays this lookup before anything else can render —
// it's the single highest-frequency query in the app. A short in-memory TTL
// cache, keyed by token, turns rapid-fire navigation (clicking through
// several tabs in a few seconds) into cache hits instead of a Postgres round
// trip each time. Best-effort only: a serverless instance can always come up
// cold with an empty cache, which just falls through to the DB exactly like
// today — this can only help, never regress, correctness.
//
// Trade-off worth knowing: a logout doesn't proactively evict this cache, so
// a captured token could still be treated as valid for up to CACHE_TTL_MS
// after the real session row is deleted elsewhere. Kept deliberately short
// (a few seconds) so that window stays negligible relative to the token
// itself being httpOnly and not trivially exfiltrated.
const CACHE_TTL_MS = 5_000;
const MAX_CACHE_ENTRIES = 5_000;
const sessionCache = new Map<string, { dto: SessionUserDTO | null; cachedAt: number }>();

function cachedSessionUser(token: string): SessionUserDTO | null | undefined {
  const entry = sessionCache.get(token);
  if (!entry) return undefined;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    sessionCache.delete(token);
    return undefined;
  }
  return entry.dto;
}

function setCachedSessionUser(token: string, dto: SessionUserDTO | null) {
  if (sessionCache.size >= MAX_CACHE_ENTRIES) {
    // Cheap unbounded-growth guard, not true LRU: Map iteration order is
    // insertion order, so this evicts the oldest entry.
    const oldestKey = sessionCache.keys().next().value;
    if (oldestKey !== undefined) sessionCache.delete(oldestKey);
  }
  sessionCache.set(token, { dto, cachedAt: Date.now() });
}

/** Exported for direct testing — updateSession() is the only production caller. */
export async function resolveSessionUser(token: string): Promise<SessionUserDTO | null> {
  const cached = cachedSessionUser(token);
  if (cached !== undefined) return cached;

  const session = await db.session.findUnique({
    where: { sessionToken: token },
    select: {
      expiresAt: true,
      user: { select: { id: true, email: true, username: true, avatarUrl: true, createdAt: true } },
    },
  });

  const isValid = !!session && session.expiresAt.getTime() > Date.now();
  const dto = isValid ? SessionUserMapper.toDTO(session.user) : null;
  setCachedSessionUser(token, dto);
  return dto;
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

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(TRUSTED_USER_HEADER);
  if (dto) {
    requestHeaders.set(TRUSTED_USER_HEADER, JSON.stringify(dto));
  }
  // Forwarded so Next's own renderer can pick the nonce back up and stamp it
  // onto the framework's inline hydration/RSC-streaming scripts — see
  // ContentSecurityPolicyBuilder's doc comment.
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}
