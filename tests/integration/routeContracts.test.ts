import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { POST as signup } from "@/app/api/signup/route";
import { POST as notificationOpened } from "@/app/api/notifications/[id]/opened/route";
import { POST as reportClientError } from "@/app/api/debug/client-error/route";
import { GET as getPhoto } from "@/app/api/photos/[entryId]/route";
import { GET as getAvatar } from "@/app/api/avatars/[userId]/route";
import { GET as getShareImage } from "@/app/api/sessions/[id]/share-image/route";
import { GET as sessionRemindersCron } from "@/app/api/cron/session-reminders/route";
import { DrinkEntryFixtureFactory } from "./fixtures/DrinkEntryFixtureFactory";
import { loginAs } from "./support/loginAs";

const fixtures = new DrinkEntryFixtureFactory(db);
const noParams = { params: Promise.resolve({}) };

function json(path: string, body: unknown, headers: Record<string, string> = {}, method = "POST") {
  return new Request(`http://app.test${path}`, {
    method,
    headers: { "content-type": "application/json", host: "app.test", ...headers },
    body: JSON.stringify(body),
  });
}

type Envelope = { error: { code: string; message: string; fields?: Record<string, string[]> } };

async function expectEnvelope(response: Response, status: number, code: string): Promise<Envelope> {
  expect(response.status).toBe(status);
  const body = (await response.json()) as Envelope;
  expect(body.error.code).toBe(code);
  expect(typeof body.error.message).toBe("string");
  return body;
}

describe("POST /api/auth/login", () => {
  it("signs a user in and answers { success: true }", async () => {
    const user = await fixtures.createUser();

    const response = await login(json("/api/auth/login", { email: user.email, password: "Test123!" }), noParams);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(await db.session.count({ where: { userId: user.id } })).toBe(1);
  });

  it("answers 401 with the envelope for a wrong password, without revealing which part was wrong", async () => {
    const user = await fixtures.createUser();

    const body = await expectEnvelope(
      await login(json("/api/auth/login", { email: user.email, password: "nope" }), noParams),
      401,
      "UNAUTHENTICATED"
    );

    expect(body.error.message).toBe("Invalid email or password.");
  });

  it("answers 400 for missing fields and for a malformed body", async () => {
    const empty = await expectEnvelope(await login(json("/api/auth/login", { email: "", password: "" }), noParams), 400, "VALIDATION_FAILED");
    expect(empty.error.message).toBe("Email and password are required.");

    const wrongTypes = await expectEnvelope(await login(json("/api/auth/login", { email: 1 }), noParams), 400, "VALIDATION_FAILED");
    expect(Object.keys(wrongTypes.error.fields ?? {})).toContain("email");
  });

  it("rejects a cross-origin request before touching credentials", async () => {
    const user = await fixtures.createUser();

    await expectEnvelope(
      await login(json("/api/auth/login", { email: user.email, password: "Test123!" }, { origin: "https://evil.example" }), noParams),
      403,
      "ORIGIN_MISMATCH"
    );
    expect(await db.session.count()).toBe(0);
  });

  it("rate limits repeated attempts from one address with Retry-After", async () => {
    const attempt = () => login(json("/api/auth/login", { email: "a@b.c", password: "x" }, { "x-forwarded-for": "9.9.9.9" }), noParams);
    for (let i = 0; i < 30; i++) await attempt();

    const limited = await attempt();

    await expectEnvelope(limited, 429, "RATE_LIMITED");
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});

describe("POST /api/signup", () => {
  it("creates an account", async () => {
    const response = await signup(
      json("/api/signup", { username: "newbie_one", email: "newbie@test.birava", password: "Test123!" }),
      noParams
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(await db.user.count({ where: { email: "newbie@test.birava" } })).toBe(1);
  });

  it("surfaces a rule violation as a 400 envelope with the rule's message", async () => {
    const body = await expectEnvelope(
      await signup(json("/api/signup", { username: "x", email: "not-an-email", password: "short" }), noParams),
      400,
      "VALIDATION_FAILED"
    );

    expect(body.error.message.length).toBeGreaterThan(0);
    expect(await db.user.count()).toBe(0);
  });
});

describe("POST /api/auth/logout", () => {
  it("answers { success: true } even with no session", async () => {
    const response = await logout(json("/api/auth/logout", {}), noParams);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });
});

describe("POST /api/notifications/[id]/opened", () => {
  it("answers 401 with the envelope when signed out", async () => {
    await expectEnvelope(await notificationOpened(json("/api/notifications/n1/opened", {}), { params: Promise.resolve({ id: "n1" }) }), 401, "UNAUTHENTICATED");
  });

  it("marks the notification opened and answers 204 when signed in", async () => {
    const user = await fixtures.createUser();
    const actor = await fixtures.createUser();
    const notification = await db.notification.create({
      data: { userId: user.id, actorId: actor.id, type: "FOLLOW", actorUsername: actor.username },
    });
    await loginAs(user.id);

    const response = await notificationOpened(json(`/api/notifications/${notification.id}/opened`, {}), {
      params: Promise.resolve({ id: notification.id }),
    });

    expect(response.status).toBe(204);
    expect((await db.notification.findUniqueOrThrow({ where: { id: notification.id } })).openedAt).not.toBeNull();
  });
});

describe("POST /api/debug/client-error", () => {
  it("stores a report and answers 204 without a session", async () => {
    const response = await reportClientError(json("/api/debug/client-error", { message: "boom", source: "window.onerror", extra: 1 }), noParams);

    expect(response.status).toBe(204);
    const rows = await db.clientErrorLog.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.message).toBe("boom");
  });

  it("refuses a body with no message and stores nothing", async () => {
    await expectEnvelope(await reportClientError(json("/api/debug/client-error", { source: "x" }), noParams), 400, "VALIDATION_FAILED");
    expect(await db.clientErrorLog.count()).toBe(0);
  });

  it("drops a wrongly typed optional field instead of rejecting the report", async () => {
    const response = await reportClientError(json("/api/debug/client-error", { message: "boom", stack: 42 }), noParams);

    expect(response.status).toBe(204);
    expect((await db.clientErrorLog.findFirstOrThrow()).stack).toBeNull();
  });
});

describe("authenticated GET routes", () => {
  const get = (path: string) => new Request(`http://app.test${path}`, { headers: { host: "app.test" } });

  it("answer 401 with the envelope when signed out", async () => {
    await expectEnvelope(await getPhoto(get("/api/photos/e1"), { params: Promise.resolve({ entryId: "e1" }) }), 401, "UNAUTHENTICATED");
    await expectEnvelope(await getAvatar(get("/api/avatars/u1"), { params: Promise.resolve({ userId: "u1" }) }), 401, "UNAUTHENTICATED");
    await expectEnvelope(await getShareImage(get("/api/sessions/s1/share-image"), { params: Promise.resolve({ id: "s1" }) }), 401, "UNAUTHENTICATED");
  });

  it("answer 404 with the envelope for something that does not exist", async () => {
    const user = await fixtures.createUser();
    await loginAs(user.id);

    await expectEnvelope(await getPhoto(get("/api/photos/nope"), { params: Promise.resolve({ entryId: "nope" }) }), 404, "NOT_FOUND");
    await expectEnvelope(await getAvatar(get("/api/avatars/nope"), { params: Promise.resolve({ userId: "nope" }) }), 404, "NOT_FOUND");
    await expectEnvelope(await getShareImage(get("/api/sessions/nope/share-image"), { params: Promise.resolve({ id: "nope" }) }), 404, "NOT_FOUND");
  });
});

describe("cron routes", () => {
  it("answer 401 with the envelope without the shared secret", async () => {
    await expectEnvelope(await sessionRemindersCron(new Request("http://app.test/api/cron/session-reminders")), 401, "UNAUTHENTICATED");
  });
});
