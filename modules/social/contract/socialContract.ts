import { z } from "zod";
import { ContractFields } from "@/lib/gateway/ContractFields";

const { id } = ContractFields;

/** `followUser` and `unfollowUser`. */
export const followInput = z.object({ targetUserId: id });

/** `toggleCheer`. */
export const toggleCheerInput = z.object({ sessionId: id });

/** `createComment`. The 500-character product rule lives in the command; this only bounds absurd input. */
export const createCommentInput = z.object({
  sessionId: id,
  body: z.string().max(5000),
});

/** `deleteComment`. */
export const deleteCommentInput = z.object({ commentId: id });
