"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { gateway } from "@/modules/identity/server/gateway";
import { createDrinkEntry, updateDrinkEntry, deleteDrinkEntry } from "@/modules/checkins/application/drinkEntryCommands";
import { renameSession as renameSessionCommand } from "@/modules/sessions";
import { drinkHistoryTag } from "@/modules/checkins/server/drinkEntryQueries";
import { getGroupIdsForUser } from "@/modules/crews/server/groupQueries";
import { createCheckinInput, updateCheckinInput, deleteCheckinInput } from "@/modules/checkins/contract/checkinContract";
import { renameSessionInput } from "@/modules/sessions/contract/sessionContract";

/** Mutations only: reads live in modules/checkins/server/drinkReads.ts (a Server Action is a public POST endpoint). */

const DRINK_PATHS = ["/dashboard", "/stats", "/log", "/profile", "/achievements"];

/**
 * Revalidates the fixed drink-related routes plus only the specific
 * session(s)/crew(s) this write could actually have changed — not every
 * `/sessions/[id]`/`/crews/[id]` for every user, which a blanket
 * `revalidatePath("/sessions", "layout")`/`("/crews", "layout")` would do.
 * `sessionPaths` is whatever the calling command already returned as its own
 * `revalidatedPaths` (e.g. `/sessions/<id>`) — that's always the exact
 * session(s) the write touched, so it doubles as the scope for the
 * server-side Next cache too, not just the client-side SW cache-eviction
 * list it was originally collected for. Crew scoring can shift on *any*
 * check-in (not just ones that start a new session — the tiebreaker counts
 * total drinks logged since joining), so crew ids are looked up fresh here
 * rather than reusing drinkEntryCommands.ts's own new-session-only
 * membership lookup (which exists to notify other members, a different
 * question from "which of my own crew pages might now look different").
 */
async function revalidateDrinkPaths(userId: string, sessionPaths: string[]): Promise<string[]> {
  for (const path of DRINK_PATHS) revalidatePath(path);
  for (const path of sessionPaths) revalidatePath(path);
  const groupIds = await getGroupIdsForUser(userId);
  for (const groupId of groupIds) revalidatePath(`/crews/${groupId}`);
  revalidateTag(drinkHistoryTag(userId));
  return DRINK_PATHS;
}

/** Applies revalidateDrinkPaths' server-side revalidation and folds its paths into `result.revalidatedPaths`, shared by every command below that returns a plain `{error?, revalidatedPaths?}`-shaped result. */
async function applyDrinkRevalidation<T extends { error?: string; revalidatedPaths?: string[] }>(
  userId: string,
  result: T
): Promise<T> {
  if (!result.error) {
    const sessionPaths = result.revalidatedPaths ?? [];
    result.revalidatedPaths = [...sessionPaths, ...(await revalidateDrinkPaths(userId, sessionPaths))];
  }
  return result;
}

export const addDrink = gateway.action.authed(
  { name: "checkins.add", input: createCheckinInput },
  async ({ user, input }) => {
    const result = await createDrinkEntry(user.id, input, {
      username: user.username,
      avatarUrl: user.avatarUrl,
    });
    return applyDrinkRevalidation(user.id, result);
  }
);

export const editDrink = gateway.action.authed(
  { name: "checkins.edit", input: updateCheckinInput },
  async ({ user, input }) => applyDrinkRevalidation(user.id, await updateDrinkEntry(user.id, input))
);

export const deleteDrink = gateway.action.authed(
  { name: "checkins.delete", input: deleteCheckinInput },
  async ({ user, input }) => applyDrinkRevalidation(user.id, await deleteDrinkEntry(user.id, input))
);

export const renameSession = gateway.action.authed(
  { name: "sessions.rename", input: renameSessionInput },
  async ({ user, input }) => applyDrinkRevalidation(user.id, await renameSessionCommand(user.id, input))
);
