import type { Comment as CommentRow } from "@prisma/client";
import type { CommentDTO } from "@/lib/dtos";
import { UserSummaryMapper } from "@/lib/mappers/user/userSummaryMapper";

export class CommentMapper {
  static toDTO(
    row: CommentRow & { user: { username: string; avatarUrl: string | null; isDeveloper: boolean } }
  ): CommentDTO {
    const author = UserSummaryMapper.toDTO({ id: row.userId, ...row.user });
    return {
      id: row.id,
      sessionId: row.sessionId,
      userId: row.userId,
      username: author.username,
      avatarUrl: author.avatarUrl,
      isDeveloper: author.isDeveloper,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
