import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addDrink, editDrink, deleteDrink, renameSession } from "@/modules/checkins/actions/drinkController";
import { toggleCheer, createComment, followUser, unfollowUser } from "@/modules/social/actions/socialController";
import { createGroup, joinGroupByInvite, leaveGroup, renameGroup } from "@/modules/crews/actions/groupController";
import { updateNotificationPreference, markNotificationsRead } from "@/modules/notifications/actions/notificationController";
import { completeOnboarding } from "@/modules/identity/actions/onboardingController";
import { updateProfileUsername } from "@/modules/identity/actions/profileController";
import { DrinkEntryFixtureFactory } from "./fixtures/DrinkEntryFixtureFactory";
import { loginAs } from "./support/loginAs";

const fixtures = new DrinkEntryFixtureFactory(db);

const validCheckin = {
  drinkName: "IPA",
  drinkType: "Beer" as const,
  venue: null,
  lat: null,
  lng: null,
  photoUrl: null,
  photoLqip: null,
};

const NO_SUCH_ID = "00000000-0000-4000-8000-000000000000";

async function signedInUser() {
  const user = await fixtures.createUser();
  await loginAs(user.id);
  return user;
}

describe("every action refuses a signed-out caller", () => {
  it("answers with an UNAUTHENTICATED failure and does nothing", async () => {
    const expected = { error: "Not authenticated", code: "UNAUTHENTICATED" };

    expect(await addDrink(validCheckin)).toEqual(expected);
    expect(await editDrink({ id: NO_SUCH_ID, ...validCheckin })).toEqual(expected);
    expect(await deleteDrink({ id: NO_SUCH_ID })).toEqual(expected);
    expect(await renameSession({ id: NO_SUCH_ID, name: "x" })).toEqual(expected);
    expect(await toggleCheer({ sessionId: NO_SUCH_ID })).toEqual(expected);
    expect(await createComment({ sessionId: NO_SUCH_ID, body: "hi" })).toEqual(expected);
    expect(await followUser({ targetUserId: NO_SUCH_ID })).toEqual(expected);
    expect(await createGroup({ name: "Crew" })).toEqual(expected);
    expect(await joinGroupByInvite({ inviteCode: "ABC123" })).toEqual(expected);
    expect(await updateNotificationPreference({ key: "notifyCheer", enabled: false })).toEqual(expected);
    expect(await markNotificationsRead()).toEqual(expected);
    expect(await completeOnboarding()).toEqual(expected);
    expect(await updateProfileUsername({ username: "someone" })).toEqual(expected);

    expect(await db.drinkEntry.count()).toBe(0);
  });
});

describe("check-in actions", () => {
  it("logs a check-in and reports the paths to refresh", async () => {
    const user = await signedInUser();

    const result = await addDrink(validCheckin);

    expect(result.error).toBeUndefined();
    expect(result.id).toBeDefined();
    expect(result.revalidatedPaths).toContain("/dashboard");
    expect(await db.drinkEntry.count({ where: { userId: user.id } })).toBe(1);
  });

  it("rejects a malformed check-in with field-level errors before anything is written", async () => {
    const user = await signedInUser();

    const result = await addDrink({ ...validCheckin, drinkType: "Whisky" as never, lat: 200 });

    expect(result).toMatchObject({ code: "VALIDATION_FAILED" });
    expect(Object.keys((result as { fields?: object }).fields ?? {}).sort()).toEqual(["drinkType", "lat"]);
    expect(await db.drinkEntry.count({ where: { userId: user.id } })).toBe(0);
  });

  it("accepts a queued payload that leaves optional fields out", async () => {
    await signedInUser();

    const result = await addDrink({ drinkType: "Wine" } as never);

    expect(result.error).toBeUndefined();
    expect(result.id).toBeDefined();
  });

  it("edits and deletes only the caller's own check-in", async () => {
    const owner = await signedInUser();
    const created = await addDrink(validCheckin);
    const id = created.id!;

    expect((await editDrink({ id, ...validCheckin, drinkName: "Stout" })).error).toBeUndefined();
    expect((await db.drinkEntry.findUniqueOrThrow({ where: { id } })).drinkName).toBe("Stout");

    const intruder = await fixtures.createUser();
    await loginAs(intruder.id);
    await deleteDrink({ id });
    expect(await db.drinkEntry.count({ where: { userId: owner.id } })).toBe(1);

    await loginAs(owner.id);
    expect((await deleteDrink({ id })).error).toBeUndefined();
    expect(await db.drinkEntry.count({ where: { userId: owner.id } })).toBe(0);
  });

  it("keeps the 40-character session name rule's own message", async () => {
    await signedInUser();
    const { id } = await addDrink(validCheckin);
    const session = await db.drinkEntry.findUniqueOrThrow({ where: { id: id! } });

    const result = await renameSession({ id: session.sessionId, name: "x".repeat(41) });

    expect(result.error).toBe("Session name is too long");
  });
});

describe("social actions", () => {
  it("toggles a cheer on and off", async () => {
    await signedInUser();
    const { id } = await addDrink(validCheckin);
    const { sessionId } = await db.drinkEntry.findUniqueOrThrow({ where: { id: id! } });

    expect(await toggleCheer({ sessionId })).toMatchObject({ on: true });
    expect(await toggleCheer({ sessionId })).toMatchObject({ on: false });
  });

  it("rejects a malformed id and keeps the comment length rule's own message", async () => {
    await signedInUser();
    const { id } = await addDrink(validCheckin);
    const { sessionId } = await db.drinkEntry.findUniqueOrThrow({ where: { id: id! } });

    expect(await toggleCheer({ sessionId: "not-an-id" })).toMatchObject({ code: "VALIDATION_FAILED" });
    expect((await createComment({ sessionId, body: "x".repeat(501) })).error).toBe("Comment is too long");
    expect((await createComment({ sessionId, body: "Nice one" })).error).toBeUndefined();
  });

  it("follows and unfollows", async () => {
    const me = await signedInUser();
    const other = await fixtures.createUser();

    expect(await followUser({ targetUserId: other.id })).toBeUndefined();
    expect(await db.follow.count({ where: { followerId: me.id } })).toBe(1);

    expect(await unfollowUser({ targetUserId: other.id })).toBeUndefined();
    expect(await db.follow.count({ where: { followerId: me.id } })).toBe(0);

    expect(await followUser({ targetUserId: "nope" })).toMatchObject({ code: "VALIDATION_FAILED" });
  });
});

describe("crew actions", () => {
  it("creates a crew, and a second member joins with its code", async () => {
    await signedInUser();
    const created = await createGroup({ name: "Friday crew" });
    expect(created.error).toBeUndefined();

    const group = await db.group.findFirstOrThrow({ where: { name: "Friday crew" } });
    const joiner = await fixtures.createUser();
    await loginAs(joiner.id);
    const joined = await joinGroupByInvite({ inviteCode: group.inviteCode });

    expect(joined.error).toBeUndefined();
    expect(await db.groupMember.count({ where: { groupId: group.id } })).toBe(2);
  });

  it("answers a wrong code with the exact product copy", async () => {
    await signedInUser();

    const result = await joinGroupByInvite({ inviteCode: "ZZZZZZ" });

    expect(result.error).toBe("That code doesn't match any crew.");
  });

  it("limits join attempts per user: the 21st in ten minutes is refused", async () => {
    await signedInUser();
    for (let i = 0; i < 20; i++) await joinGroupByInvite({ inviteCode: "ZZZZZZ" });

    const result = await joinGroupByInvite({ inviteCode: "ZZZZZZ" });

    expect(result).toMatchObject({ code: "RATE_LIMITED", error: "Too many attempts — try again in a few minutes." });
  });

  it("validates ids and keeps the command's own rules", async () => {
    await signedInUser();
    await createGroup({ name: "Friday crew" });
    const group = await db.group.findFirstOrThrow({ where: { name: "Friday crew" } });

    expect(await leaveGroup({ groupId: "nope" })).toMatchObject({ code: "VALIDATION_FAILED" });
    expect((await renameGroup({ groupId: group.id, name: "x" })).error).toBe("Crew name must be at least 2 characters");
  });
});

describe("notification and profile actions", () => {
  it("stores a preference and rejects an unknown key", async () => {
    const user = await signedInUser();

    expect(await updateNotificationPreference({ key: "notifyCheer", enabled: false })).toBeUndefined();
    expect(await db.notificationPreference.count({ where: { userId: user.id, enabled: false } })).toBe(1);

    expect(await updateNotificationPreference({ key: "notifyEverything" as never, enabled: false })).toMatchObject({
      code: "VALIDATION_FAILED",
    });
  });

  it("completes onboarding", async () => {
    const user = await signedInUser();

    expect((await completeOnboarding()).error).toBeUndefined();
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).onboardedAt).not.toBeNull();
  });

  it("renames a username and refuses one that is taken", async () => {
    await signedInUser();
    const other = await fixtures.createUser();

    expect((await updateProfileUsername({ username: "fresh_name" })).error).toBeUndefined();
    // The command's own marker for a taken name, which the profile form turns into friendly copy.
    expect((await updateProfileUsername({ username: other.username })).error).toBe("unique constraint");
  });
});
