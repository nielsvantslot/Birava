import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { DrinkEntryFixtureFactory } from "../fixtures/DrinkEntryFixtureFactory";
import { V1TestClient } from "./V1TestClient";

const fixtures = new DrinkEntryFixtureFactory(db);

async function signIn(client: V1TestClient, email: string, password = "Test123!") {
  const response = await client.call("POST", "/auth/token", { body: { email, password } });
  return { response, body: (await response.json()) as { token?: string; user?: { id: string; email: string } } };
}

describe("bearer-token sessions for native clients", () => {
  it("lets a client sign in, call an authenticated endpoint, and be signed out everywhere", async () => {
    const user = await fixtures.createUser();
    const client = new V1TestClient();

    const { response, body } = await signIn(client, user.email);
    expect(response.status).toBe(200);
    expect(body.token).toMatch(/^[\w-]{16,}$/);
    expect(body.user).toMatchObject({ id: user.id, email: user.email });

    const me = await client.call("GET", "/me", { token: body.token });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ id: user.id });

    // A second device signs in too: two sessions, one user.
    const second = (await signIn(client, user.email)).body.token!;
    expect(await db.session.count({ where: { userId: user.id } })).toBe(2);

    const out = await client.call("POST", "/auth/logout-all", { token: body.token });
    expect(out.status).toBe(204);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);

    expect((await client.call("GET", "/me", { token: body.token })).status).toBe(401);
    expect((await client.call("GET", "/me", { token: second })).status).toBe(401);
  });

  it("revokes only the token it is given when signing out of one device", async () => {
    const user = await fixtures.createUser();
    const client = new V1TestClient();
    const first = (await signIn(client, user.email)).body.token!;
    const second = (await signIn(client, user.email)).body.token!;

    expect((await client.call("DELETE", "/auth/token", { token: first })).status).toBe(204);

    expect((await client.call("GET", "/me", { token: first })).status).toBe(401);
    expect((await client.call("GET", "/me", { token: second })).status).toBe(200);
  });

  it("refuses a wrong password and an unknown or malformed token", async () => {
    const user = await fixtures.createUser();
    const client = new V1TestClient();

    const wrong = await signIn(client, user.email, "nope");
    expect(wrong.response.status).toBe(401);
    expect(await db.session.count()).toBe(0);

    expect((await client.call("GET", "/me", { token: "0123456789abcdef-unknown-token" })).status).toBe(401);
    expect((await client.call("GET", "/me", { headers: { authorization: "Bearer short" } })).status).toBe(401);
    expect((await client.call("GET", "/me")).status).toBe(401);
  });

  it("does not accept an expired token, and clears it", async () => {
    const user = await fixtures.createUser();
    const client = new V1TestClient();
    const token = (await signIn(client, user.email)).body.token!;
    await db.session.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    expect((await client.call("GET", "/me", { token })).status).toBe(401);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("ends bearer tokens when the account is deleted, because it is the same session table", async () => {
    const user = await fixtures.createUser();
    const client = new V1TestClient();
    const token = (await signIn(client, user.email)).body.token!;

    await db.session.deleteMany({ where: { userId: user.id } }); // what requestAccountDeletion does first

    expect((await client.call("GET", "/me", { token })).status).toBe(401);
  });

  it("reads a cancelled deletion back to the client when signing in during the grace period", async () => {
    const user = await fixtures.createUser();
    await db.user.update({ where: { id: user.id }, data: { deletionRequestedAt: new Date() } });

    const { body } = await signIn(new V1TestClient(), user.email);

    expect(body).toMatchObject({ cancelledDeletion: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).deletionRequestedAt).toBeNull();
  });
});
