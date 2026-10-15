import crypto from "crypto";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { sessionRepository } from "@/modules/identity/server/sessionRepository";
import { evictSessionUser, resolveSessionUser } from "@/modules/identity/server/proxy-session";
import { SessionUserDTO } from "@/lib/dtos";
import { Env } from "@/lib/env/Env";

const SESSION_COOKIE = "birava_session";
const SESSION_TTL_DAYS = 30;

// `middleware.ts`/`proxy-session.ts` strip this header from every incoming
// request before setting it themselves, so it isn't attacker-reachable — but
// JSON.parse's result is still untyped, and this is the standard, correct
// pattern for proving a parsed value's shape at runtime rather than trusting
// a bare cast. A future SessionUserDTO field change that isn't mirrored here
// fails closed (falls through to the real session lookup) instead of
// silently shipping a malformed session.
function isSessionUserDTO(value: unknown): value is SessionUserDTO {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "username" in value &&
    typeof value.username === "string" &&
    "avatarUrl" in value &&
    (value.avatarUrl === null || typeof value.avatarUrl === "string") &&
    "createdAt" in value &&
    typeof value.createdAt === "string" &&
    "email" in value &&
    typeof value.email === "string" &&
    "isDeveloper" in value &&
    typeof value.isDeveloper === "boolean"
  );
}

function expiryDate() {
  const expires = new Date();
  expires.setDate(expires.getDate() + SESSION_TTL_DAYS);
  return expires;
}

async function readSessionToken() {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/**
 * Starts a session without touching cookies: the opaque token a native client
 * keeps and sends as `Authorization: Bearer <token>`. It is a row in the same
 * Session table a browser's cookie points at, so every way of ending sessions
 * (logout, logout everywhere, account deletion) covers both kinds.
 */
export async function issueSessionToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomUUID();
  const expiresAt = expiryDate();
  await sessionRepository.create({ userId, sessionToken: token, expiresAt });
  return { token, expiresAt };
}

/** Ends one session by its token (cookie or bearer alike). */
export async function revokeSessionToken(token: string): Promise<void> {
  await sessionRepository.deleteByToken(token);
  evictSessionUser(token);
}

/** Ends every session a user has, on every device and in every client. */
export async function revokeAllSessions(userId: string): Promise<void> {
  await sessionRepository.deleteAllForUser(userId);
  evictSessionUser();
}

/** The bearer token a request carries, if any. */
async function readBearerToken(): Promise<string | null> {
  const header = (await headers()).get("authorization");
  const match = header ? /^Bearer\s+([\w-]{16,128})$/i.exec(header) : null;
  return match?.[1] ?? null;
}

export async function createUserSession(userId: string) {
  const { token, expiresAt } = await issueSessionToken(userId);

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: Env.isProduction,
    path: "/",
    expires: expiresAt,
  });
}

export async function clearUserSession() {
  const token = await readSessionToken();
  if (token) {
    await sessionRepository.deleteByToken(token);
    evictSessionUser(token);
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: Env.isProduction,
    path: "/",
    expires: new Date(0),
  });
}

export const getCurrentUser = cache(async (): Promise<SessionUserDTO | null> => {
  // Resolved from the token on every request, never from a request header:
  // a header a client can send is a header a client can forge (this once let
  // a hand-made x-birava-session-user header sign in as anyone on any path the
  // middleware matcher skips). The short TTL cache inside the resolver keeps
  // this cheap.
  const token = (await readSessionToken()) ?? (await readBearerToken());
  if (!token) return null;
  const user = await resolveSessionUser(token);
  // An unknown or expired token: drop its row (a no-op for an unknown one) so an expired session does not linger.
  if (!user) await sessionRepository.deleteByToken(token);
  return user;
});
