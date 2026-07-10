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
