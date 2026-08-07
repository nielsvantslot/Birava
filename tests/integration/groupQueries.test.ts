import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createDrinkEntry } from "@/lib/commands/drinkEntryCommands";
import { getCrewDetailForViewer } from "@/lib/queries/groupQueries";

const HOUR = 60 * 60 * 1000;

const emptyPayload = {
  drinkName: null,
  drinkType: "Beer" as const,
  venue: null,
  lat: null,
  lng: null,
  photoUrl: null,
  photoLqip: null,
};

let userSeq = 0;
async function createUser() {
  userSeq += 1;
  return db.user.create({
    data: {
      username: `crew_query_user_${userSeq}`,
      email: `crew_query_user_${userSeq}@test.birava`,
      passwordHash: "x",
    },
  });
}

let groupSeq = 0;
async function createGroupWithOwner(ownerId: string, joinedAt: Date) {
  groupSeq += 1;
  const group = await db.group.create({
    data: { name: `Test Crew ${groupSeq}`, inviteCode: `TESTCODE${groupSeq}`, ownerId },
  });
  await db.groupMember.create({
    data: { groupId: group.id, userId: ownerId, role: "OWNER", joinedAt },
  });
  return group;
}

describe("getCrewDetailForViewer", () => {
  it("links recent sessions by their permanent DB id, not a recomputed one", async () => {
    const owner = await createUser();
    const actor = { username: owner.username, avatarUrl: owner.avatarUrl };
    const group = await createGroupWithOwner(owner.id, new Date(Date.now() - 2 * HOUR));

    // Anchor check-in "now" — this becomes the session's permanent id.
    const anchorResult = await createDrinkEntry(
      owner.id,
      { ...emptyPayload, venue: "Café Gollem" },
      actor
    );
    if (anchorResult.error) throw new Error(anchorResult.error);
    const anchor = await db.drinkEntry.findUniqueOrThrow({ where: { id: anchorResult.id! } });

    // Backdated check-in, chronologically earlier but within the 4h gap —
    // attaches to the same session. The session's stored id stays the
    // anchor's, even though a raw re-sort-by-createdAt recomputation
    // (groupIntoSessions) would put this one first and derive its id
    // instead — the exact drift getRecentCrewSessions must not reproduce.
    const backdatedResult = await createDrinkEntry(
      owner.id,
      { ...emptyPayload, venue: "Café Gollem", createdAt: Date.now() - HOUR },
      actor
    );
    if (backdatedResult.error) throw new Error(backdatedResult.error);
    const backdated = await db.drinkEntry.findUniqueOrThrow({ where: { id: backdatedResult.id! } });

    expect(backdated.sessionId).toBe(anchor.sessionId);
    expect(anchor.sessionId).toBe(anchor.id);

    const detail = await getCrewDetailForViewer(group.id, owner.id);
    expect(detail).not.toBeNull();
    expect(detail!.recentSessions).toHaveLength(1);
    expect(detail!.recentSessions[0].id).toBe(anchor.sessionId);
    expect(detail!.recentSessions[0].id).not.toBe(backdated.id);
  });

  it("counts distinct venues per member (venue relation included in the scoring query)", async () => {
    const owner = await createUser();
    const actor = { username: owner.username, avatarUrl: owner.avatarUrl };
    const group = await createGroupWithOwner(owner.id, new Date(Date.now() - 2 * HOUR));

    const first = await createDrinkEntry(owner.id, { ...emptyPayload, venue: "Café Gollem" }, actor);
    if (first.error) throw new Error(first.error);
    const second = await createDrinkEntry(
      owner.id,
      { ...emptyPayload, venue: "The Local Taphouse" },
      actor
    );
    if (second.error) throw new Error(second.error);

    const detail = await getCrewDetailForViewer(group.id, owner.id);
    expect(detail).not.toBeNull();
    const ownerScore = detail!.scores.find((s) => s.userId === owner.id);
    expect(ownerScore?.venues).toBe(2);
  });
});
