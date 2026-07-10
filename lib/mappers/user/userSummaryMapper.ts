import type { User as UserRow } from "@prisma/client";
import type { UserSummaryDTO } from "@/lib/dtos";

export class UserSummaryMapper {
  static toDTO(user: Pick<UserRow, "id" | "username" | "avatarUrl">): UserSummaryDTO {
    return {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
    };
  }
}
