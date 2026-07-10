import type { User as UserRow } from "@prisma/client";
import type { ProfileDTO } from "@/lib/dtos";

export class ProfileMapper {
  static toDTO(user: UserRow): ProfileDTO {
    return {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
