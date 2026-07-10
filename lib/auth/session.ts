import crypto from "crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { SessionUserDTO } from "@/lib/dtos";
import { SessionUserMapper } from "@/lib/mappers";

const SESSION_COOKIE = "birava_session";
const SESSION_TTL_DAYS = 30;

function expiryDate() {
  const expires = new Date();
  expires.setDate(expires.getDate() + SESSION_TTL_DAYS);
  return expires;
}

async function readSessionToken() {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function createUserSession(userId: string) {
  const token = crypto.randomUUID();
  const expiresAt = expiryDate();

  await db.session.create({
    data: {
      userId,
      sessionToken: token,
      expiresAt,
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearUserSession() {
  const token = await readSessionToken();
  if (token) {
    await db.session.deleteMany({ where: { sessionToken: token } });
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

export const getCurrentUser = cache(async (): Promise<SessionUserDTO | null> => {
  const token = await readSessionToken();
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { sessionToken: token },
    include: { user: true },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { sessionToken: token } });
    return null;
  }

  return SessionUserMapper.toDTO(session.user);
});
