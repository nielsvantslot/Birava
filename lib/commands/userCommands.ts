import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { avatarPhotoService } from "@/lib/avatarPhoto";
import { ActionResultDTO, AvatarUploadResultDTO, CreateUserDTO, UpdateProfileDTO } from "@/lib/dtos";

export async function createUser(input: CreateUserDTO): Promise<ActionResultDTO> {
  const username = input.username.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (username.length < 2 || username.length > 30) {
    return { error: "Username must be between 2 and 30 characters." };
  }

  if (!email) {
    return { error: "Email is required." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  try {
    const passwordHash = await hashPassword(password);
    await db.user.create({
      data: {
        email,
        username,
        passwordHash,
      },
    });
  } catch (createError) {
    const code =
      createError instanceof Prisma.PrismaClientKnownRequestError
        ? createError.code
        : null;

    if (code === "P2002") {
      const target =
        createError instanceof Prisma.PrismaClientKnownRequestError
          ? (createError.meta?.target as string[] | undefined)?.join(",") ?? ""
          : "";

      if (target.includes("username")) {
        return { error: "That username is already taken." };
      }

      if (target.includes("email")) {
        return { error: "An account with this email already exists." };
      }
    }

    return { error: "Failed to create account. Please try again." };
  }

  return {};
}

/** Marks the first-run onboarding flow (app/onboarding) done, whether the user finished it or skipped it — either way there's nothing left to show. */
export async function completeOnboarding(userId: string): Promise<ActionResultDTO> {
  await db.user.update({
    where: { id: userId },
    data: { hasCompletedOnboarding: true },
  });
  return {};
}

export async function updateProfileUsername(
  userId: string,
  input: UpdateProfileDTO
): Promise<ActionResultDTO> {
  const username = input.username.trim();

  try {
    await db.user.update({
      where: { id: userId },
      data: { username },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "unique constraint" };
    }
    return { error: "Failed to update username." };
  }

  return {};
}

export async function updateProfileAvatar(
  userId: string,
  avatarUrl: string
): Promise<ActionResultDTO> {
  const existing = await db.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });

  try {
    await db.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });
  } catch {
    return { error: "Failed to update profile picture." };
  }

  // Mirrors updateDrinkEntry (lib/commands/drinkEntryCommands.ts) — only
  // clean up the old blob once the new one is durably saved, never before.
  if (existing?.avatarUrl && existing.avatarUrl !== avatarUrl) {
    await avatarPhotoService.remove(existing.avatarUrl, userId);
  }

  return {};
}

/**
 * The saga shared by both avatar upload routes (`app/api/uploads/avatar/route.ts`
 * for the plain path, `finalize/route.ts` for the direct-upload path): the
 * blob is already durably stored by the time this runs, so a failed DB link
 * is rolled back by deleting it — otherwise it's an orphan with nothing left
 * to reference it (see `lib/commands/photoCleanupCommands.ts`, the backstop
 * for whatever still slips through).
 */
async function linkAvatarOrRollback(userId: string, url: string): Promise<AvatarUploadResultDTO> {
  const result = await updateProfileAvatar(userId, url);
  if (result.error) {
    await avatarPhotoService.remove(url, userId);
    return { error: result.error };
  }
  return { url };
}

/** Plain single-request upload path (local dev disk storage — see lib/storageAdapterFactory.ts). */
export async function storeAvatar(userId: string, file: File): Promise<AvatarUploadResultDTO> {
  const { url } = await avatarPhotoService.processAndStore(file, userId);
  return linkAvatarOrRollback(userId, url);
}

/** Direct-to-Blob upload path's follow-up step (production/staging — see lib/storageAdapterFactory.ts). */
export async function finalizeAvatarUpload(userId: string, rawUrl: string): Promise<AvatarUploadResultDTO> {
  const { url } = await avatarPhotoService.finalizeDirectUpload(rawUrl, userId);
  return linkAvatarOrRollback(userId, url);
}
