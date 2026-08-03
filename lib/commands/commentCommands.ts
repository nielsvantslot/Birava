import { db } from "@/lib/db";
import { CommentMapper } from "@/lib/mappers";
import { CreateCommentResultDTO, DeleteCommentResultDTO } from "@/lib/dtos";
import { queueNotifications } from "@/lib/notify";

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

  const session = await db.drinkSession.findUnique({ where: { id: sessionId }, select: { userId: true } });
  if (session) {
    queueNotifications([
      {
        userId: session.userId,
        type: "COMMENT",
        actorId: userId,
        actorUsername: row.user.username,
        actorAvatarUrl: row.user.avatarUrl,
        entryId: sessionId,
      },
    ]);
  }

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
