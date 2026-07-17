import type { User as UserRow } from "@prisma/client";
import type { SessionUserDTO } from "@/lib/dtos";

export class SessionUserMapper {
  static toDTO(
    user: Pick<UserRow, "id" | "email" | "username" | "avatarUrl" | "createdAt">
  ): SessionUserDTO {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
