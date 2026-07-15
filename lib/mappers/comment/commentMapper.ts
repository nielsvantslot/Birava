import type { Comment as CommentRow } from "@prisma/client";
import type { CommentDTO } from "@/lib/dtos";

export class CommentMapper {
  static toDTO(
    row: CommentRow & { user: { username: string; avatarUrl: string | null } }
  ): CommentDTO {
    return {
      id: row.id,
      sessionId: row.sessionId,
      userId: row.userId,
      username: row.user.username,
      avatarUrl: row.user.avatarUrl,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
