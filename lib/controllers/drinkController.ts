"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { NOT_AUTHENTICATED } from "@/lib/auth/authErrors";
import { createDrinkEntry, updateDrinkEntry, deleteDrinkEntry } from "@/lib/commands/drinkEntryCommands";
import { getDrinkEntriesByUser } from "@/lib/queries/drinkEntryQueries";
import {
  ActionResultDTO,
  AddDrinkResultDTO,
  DrinkEntryDTO,
  CreateDrinkEntryDTO,
  DeleteDrinkEntryDTO,
  GetMyDrinkEntriesDTO,
  GetPublicDrinkEntriesForUserDTO,
  UpdateDrinkEntryDTO,
} from "@/lib/dtos";

const DRINK_PATHS = ["/dashboard", "/stats", "/log", "/profile", "/achievements"];
const MAX_PUBLIC_LIMIT = 50;

function revalidateDrinkPaths() {
  for (const path of DRINK_PATHS) revalidatePath(path);
  revalidatePath("/sessions", "layout");
  revalidatePath("/crews", "layout");
}

export async function addDrink(input: CreateDrinkEntryDTO): Promise<AddDrinkResultDTO> {
  const user = await getCurrentUser();
  if (!user) return NOT_AUTHENTICATED;

  const result = await createDrinkEntry(user.id, input);
  if (!result.error) revalidateDrinkPaths();
  return result;
}

export async function editDrink(input: UpdateDrinkEntryDTO): Promise<ActionResultDTO> {
  const user = await getCurrentUser();
  if (!user) return NOT_AUTHENTICATED;

  const result = await updateDrinkEntry(user.id, input);
  if (!result.error) revalidateDrinkPaths();
  return result;
}

export async function deleteDrink(input: DeleteDrinkEntryDTO): Promise<ActionResultDTO> {
  const user = await getCurrentUser();
  if (!user) return NOT_AUTHENTICATED;

  const result = await deleteDrinkEntry(user.id, input);
  if (!result.error) revalidateDrinkPaths();
  return result;
}

/** Always scoped to the current session's own id — the caller can never supply a different one. */
export async function getMyDrinkEntries(input: GetMyDrinkEntriesDTO): Promise<DrinkEntryDTO[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  return getDrinkEntriesByUser(user.id, {
    orderByCreatedAt: input.orderByCreatedAt,
    limit: input.limit,
  });
}

/** Public read (no auth required, matches today's public-profile view) — `limit` is required and capped. */
export async function getPublicDrinkEntriesForUser(
  input: GetPublicDrinkEntriesForUserDTO
): Promise<DrinkEntryDTO[]> {
  return getDrinkEntriesByUser(input.userId, {
    orderByCreatedAt: "desc",
    limit: Math.min(input.limit, MAX_PUBLIC_LIMIT),
  });
}
