import { db } from "@/lib/db";
import { CommentMapper } from "@/lib/mappers";
import { CreateCommentResultDTO, DeleteCommentResultDTO } from "@/lib/dtos";

const MAX_COMMENT_LENGTH = 500;

export async function createComment(
  userId: string,
  sessionId: string,
  body: string
): Promise<CreateCommentResultDTO> {
  const trimmed = body.trim();
  if (!trimmed) return { error: "Comment can't be empty" };
  if (trimmed.length > MAX_COMMENT_LENGTH) return { error: "Comment is too long" };

  const row = await db.comment.create({
    data: { sessionId, userId, body: trimmed },
    include: { user: { select: { username: true, avatarUrl: true } } },
  });

  return { comment: CommentMapper.toDTO(row) };
}

export async function deleteComment(
  userId: string,
  commentId: string
): Promise<DeleteCommentResultDTO> {
  const existing = await db.comment.findUnique({ where: { id: commentId } });
  if (!existing || existing.userId !== userId) {
    return { error: "Comment not found" };
  }

  await db.comment.delete({ where: { id: commentId } });
  return {};
}
