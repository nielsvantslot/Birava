// Loaded before this file's own imports resolve, in particular before
// `@/lib/db` is ever imported (by this file or by any command/query module
// a test imports) — Prisma reads DATABASE_URL from process.env at client
// construction time, so this must run first for the app's db singleton to
// actually point at the isolated test database instead of dev's. `override:
// true` is required here: this process already has DATABASE_URL set (the
// dev value, inherited from birava-app's own container environment), and
// dotenv's default is to never clobber an already-set variable.
import dotenv from "dotenv";
dotenv.config({ path: ".env.test", override: true });

// Belt-and-suspenders: a truncating reset against the wrong database is a
// silent-data-loss bug waiting to happen, and the override above has
// exactly one job — if it didn't take effect for any reason (a future
// refactor, a different invocation path, ...), fail loudly here rather than
// truncating/writing to dev.
if (!/\bbirava_test\b/.test(process.env.DATABASE_URL ?? "")) {
  throw new Error(
    `Integration tests must run against the isolated test database, but DATABASE_URL is: ${process.env.DATABASE_URL}`
  );
}

import { afterAll, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { PostgresDatabaseReset } from "./PostgresDatabaseReset";
import { FakeCookieStore } from "./support/FakeCookieStore";

// Command/query functions call getCurrentUser()/getUserTimeZone(), which
// read next/headers's cookies()/headers() — real only inside an actual
// Next.js request, which none of these direct function-call tests have.
vi.mock("next/headers", () => ({
  cookies: async () => new FakeCookieStore(),
  headers: async () => new Headers(),
}));

// lib/notify.ts defers notification writes via next/server's after(), also
// real only inside a request — just run the callback immediately instead.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (callback: () => unknown) => {
    void callback();
  },
}));

// unstable_cache needs Next's incremental-cache context, real only inside an
// actual request/build — direct function-call tests have neither. Callers
// (getDrinkHistory, getSessionsForUserIds, ...) only care that the wrapped
// function's result comes back; skip the caching itself rather than fail
// outright.
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  unstable_cache:
    <T extends (...args: never[]) => unknown>(fn: T) =>
    (...args: Parameters<T>) =>
      fn(...args),
}));

const reset = new PostgresDatabaseReset(db);

beforeEach(async () => {
  await reset.reset();
});

afterAll(async () => {
  await db.$disconnect();
});
