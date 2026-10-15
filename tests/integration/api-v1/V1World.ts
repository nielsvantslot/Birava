import { db } from "@/lib/db";
import { createDrinkEntry } from "@/modules/checkins/application/drinkEntryCommands";
import { createComment } from "@/modules/social/application/commentCommands";
import { createGroup } from "@/modules/crews/application/groupCommands";
import { issueSessionToken } from "@/modules/identity/server/session";
import { DrinkEntryFixtureFactory } from "../fixtures/DrinkEntryFixtureFactory";

const fixtures = new DrinkEntryFixtureFactory(db);

const emptyCheckin = { drinkName: "IPA", drinkType: "Beer" as const, venue: null, lat: null, lng: null, photoUrl: null, photoLqip: null };

/** One signed-in user, plus whatever else a contract scenario needs to exist (a check-in, another person, a crew). */
export class V1World {
  private constructor(
    readonly user: { id: string; username: string; email: string; avatarUrl: string | null },
    readonly token: string
  ) {}

  static async create(): Promise<V1World> {
    const user = await fixtures.createUser();
    const { token } = await issueSessionToken(user.id);
    return new V1World(user, token);
  }

  /** The password every fixture user has. */
  static readonly PASSWORD = "Test123!";

  async otherUser() {
    return fixtures.createUser();
  }

  /** A check-in of this user's; returns its id and its session's id. */
  async checkin(): Promise<{ id: string; sessionId: string }> {
    const result = await createDrinkEntry(this.user.id, { ...emptyCheckin, createdAt: Date.now() - 60_000 }, { username: this.user.username, avatarUrl: null });
    const entry = await db.drinkEntry.findUniqueOrThrow({ where: { id: result.id! } });
    return { id: entry.id, sessionId: entry.sessionId };
  }

  /** A comment this user wrote on their own session. */
  async comment(): Promise<{ id: string; sessionId: string }> {
    const { sessionId } = await this.checkin();
    const result = await createComment(this.user.id, sessionId, "First!");
    return { id: result.comment!.id, sessionId };
  }

  /** A crew this user owns. */
  async crew(): Promise<{ id: string; inviteCode: string }> {
    await createGroup(this.user.id, { name: "Friday crew" });
    const group = await db.group.findFirstOrThrow({ where: { ownerId: this.user.id } });
    return { id: group.id, inviteCode: group.inviteCode };
  }

  /** A crew somebody else owns, to join by its code. */
  async someoneElsesCrew(): Promise<{ inviteCode: string }> {
    const owner = await this.otherUser();
    await createGroup(owner.id, { name: "Their crew" });
    const group = await db.group.findFirstOrThrow({ where: { ownerId: owner.id } });
    return { inviteCode: group.inviteCode };
  }
}
