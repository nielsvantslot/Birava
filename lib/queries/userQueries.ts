import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { ProfileMapper, UserSummaryMapper } from "@/lib/mappers";
import { ProfileDTO, UserSummaryDTO } from "@/lib/dtos";

export async function verifyCredentials(email: string, password: string): Promise<string | null> {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return null;

  const valid = await verifyPassword(password, user.passwordHash);
  return valid ? user.id : null;
}

export async function getProfileByUsername(username: string): Promise<ProfileDTO | null> {
  const user = await db.user.findUnique({ where: { username } });
  return user ? ProfileMapper.toDTO(user) : null;
}

const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve a user's avatar storage URL for serving — mirrors
 * getViewableDrinkPhotoUrl (lib/queries/drinkEntryQueries.ts). No per-viewer
 * visibility gate: an avatar is shown to every other user throughout the app
 * (header, comments, crew leaderboards, sessions, …), so any authenticated
 * viewer can see any user's avatar — the avatars route still requires a
 * logged-in user via requireUser.
 */
export async function getViewableAvatarUrl(userId: string): Promise<string | null> {
  if (!USER_ID_PATTERN.test(userId)) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });
  return user?.avatarUrl ?? null;
}

export async function searchUsers(excludeUserId: string, query: string): Promise<UserSummaryDTO[]> {
  const users = await db.user.findMany({
    where: {
      username: { contains: query.trim(), mode: "insensitive" },
      id: { not: excludeUserId },
    },
    select: { id: true, username: true, avatarUrl: true },
    take: 20,
  });

  return users.map((user) => UserSummaryMapper.toDTO(user));
}
