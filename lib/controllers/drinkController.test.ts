import { beforeEach, describe, expect, it, vi } from "vitest";

const { revalidatePath, revalidateTag } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { createDrinkEntry, updateDrinkEntry, deleteDrinkEntry } = vi.hoisted(() => ({
  createDrinkEntry: vi.fn(),
  updateDrinkEntry: vi.fn(),
  deleteDrinkEntry: vi.fn(),
}));
const { renameSession } = vi.hoisted(() => ({ renameSession: vi.fn() }));
const { getGroupIdsForUser } = vi.hoisted(() => ({ getGroupIdsForUser: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath, revalidateTag }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser }));
vi.mock("@/lib/commands/drinkEntryCommands", () => ({ createDrinkEntry, updateDrinkEntry, deleteDrinkEntry }));
vi.mock("@/lib/commands/drinkSessionCommands", () => ({ renameSession }));
vi.mock("@/lib/queries/groupQueries", () => ({ getGroupIdsForUser }));
vi.mock("@/lib/queries/drinkEntryQueries", () => ({
  getDrinkHistory: vi.fn(),
  getDrinkEntryForUser: vi.fn(),
  getRecentDrinkHistory: vi.fn(),
  drinkHistoryTag: (userId: string) => `drink-history:${userId}`,
}));
vi.mock("@/lib/queries/drinkSessionQueries", () => ({
  getSessionById: vi.fn(),
  getSessionsForUserIds: vi.fn(),
}));
vi.mock("@/lib/queries/cheerQueries", () => ({ getCheerStates: vi.fn() }));
vi.mock("@/lib/queries/commentQueries", () => ({ getCommentCounts: vi.fn() }));
vi.mock("@/lib/queries/followQueries", () => ({ getFollowingIds: vi.fn() }));

import { addDrink, editDrink, deleteDrink, renameSession as renameSessionAction } from "./drinkController";

const USER = { id: "user-1", username: "niels", avatarUrl: null };

// revalidateDrinkPaths (the shared helper behind every mutation below) used
// to blanket-invalidate revalidatePath("/sessions", "layout") and
// ("/crews", "layout") — every session and crew page for every user, on any
// one user's check-in write. These pin the fix: only the specific session
// path the command itself reports, and only crews this user actually
// belongs to, ever get revalidated.
describe("drinkController revalidation scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue(USER);
    getGroupIdsForUser.mockResolvedValue(["crew-a", "crew-b"]);
  });

  it("addDrink revalidates only its own session and this user's crews", async () => {
    createDrinkEntry.mockResolvedValue({
      achievementUnlocked: false,
      id: "entry-1",
      revalidatedPaths: ["/sessions/session-1"],
    });

    await addDrink({ drinkName: "IPA", drinkType: "Beer", venue: null, lat: null, lng: null, photoUrl: null, photoLqip: null });

    expect(revalidatePath).toHaveBeenCalledWith("/sessions/session-1");
    expect(revalidatePath).toHaveBeenCalledWith("/crews/crew-a");
    expect(revalidatePath).toHaveBeenCalledWith("/crews/crew-b");
  });

  it("never blanket-invalidates every session or every crew", async () => {
    createDrinkEntry.mockResolvedValue({
      achievementUnlocked: false,
      id: "entry-1",
      revalidatedPaths: ["/sessions/session-1"],
    });

    await addDrink({ drinkName: "IPA", drinkType: "Beer", venue: null, lat: null, lng: null, photoUrl: null, photoLqip: null });

    expect(revalidatePath).not.toHaveBeenCalledWith("/sessions", "layout");
    expect(revalidatePath).not.toHaveBeenCalledWith("/crews", "layout");
  });

  it("editDrink and deleteDrink each scope to their own command's reported session path", async () => {
    updateDrinkEntry.mockResolvedValue({ revalidatedPaths: ["/sessions/session-2"] });
    deleteDrinkEntry.mockResolvedValue({ revalidatedPaths: ["/sessions/session-3"] });

    await editDrink({ id: "entry-2", drinkName: "IPA", drinkType: "Beer", venue: null, lat: null, lng: null, photoUrl: null, photoLqip: null });
    await deleteDrink({ id: "entry-3" });

    expect(revalidatePath).toHaveBeenCalledWith("/sessions/session-2");
    expect(revalidatePath).toHaveBeenCalledWith("/sessions/session-3");
    expect(revalidatePath).not.toHaveBeenCalledWith("/sessions/session-3", "layout");
  });

  it("skips crew revalidation entirely for a user in no crews", async () => {
    getGroupIdsForUser.mockResolvedValue([]);
    renameSession.mockResolvedValue({ revalidatedPaths: ["/sessions/session-4"] });

    await renameSessionAction({ id: "session-4", name: "Big night" });

    expect(revalidatePath).toHaveBeenCalledWith("/sessions/session-4");
    expect(revalidatePath).not.toHaveBeenCalledWith(expect.stringMatching(/^\/crews\//));
  });
});
