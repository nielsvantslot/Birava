"use server";

import { revalidatePath } from "next/cache";
import { gateway } from "@/modules/identity/server/gateway";
import { followUser as followUserCommand, unfollowUser as unfollowUserCommand } from "@/modules/social/application/followCommands";
import { toggleCheer as toggleCheerCommand } from "@/modules/social/application/cheerCommands";
import {
  createComment as createCommentCommand,
  deleteComment as deleteCommentCommand,
} from "@/modules/social/application/commentCommands";
import {
  createCommentInput,
  deleteCommentInput,
  followInput,
  toggleCheerInput,
} from "@/modules/social/contract/socialContract";

// Mutations only: reads live in modules/social/server/socialReads.ts (a Server Action is a public POST endpoint).

/** F9: the follower/following counts render on the public profile too — refresh it along with the rest, which the old path list missed. */
function revalidateFollowPaths(): void {
  revalidatePath("/dashboard");
  revalidatePath("/people");
  revalidatePath("/profile/[username]", "page");
  revalidatePath("/profile");
}

function revalidateSessionInteractionPaths(): void {
  revalidatePath("/dashboard");
  revalidatePath("/sessions", "layout");
}

export const followUser = gateway.action.authed(
  { name: "social.follow", input: followInput },
  async ({ user, input }) => {
    await followUserCommand(user.id, input, {
      username: user.username,
      avatarUrl: user.avatarUrl,
    });

    revalidateFollowPaths();
  }
);

export const unfollowUser = gateway.action.authed(
  { name: "social.unfollow", input: followInput },
  async ({ user, input }) => {
    await unfollowUserCommand(user.id, input);

    revalidateFollowPaths();
  }
);

export const toggleCheer = gateway.action.authed(
  { name: "social.toggle-cheer", input: toggleCheerInput },
  async ({ user, input }) => {
    const result = await toggleCheerCommand(user.id, input.sessionId, {
      username: user.username,
      avatarUrl: user.avatarUrl,
    });
    if (!result.error) revalidateSessionInteractionPaths();
    return result;
  }
);

export const createComment = gateway.action.authed(
  { name: "social.create-comment", input: createCommentInput },
  async ({ user, input }) => {
    const result = await createCommentCommand(user.id, input.sessionId, input.body);
    if (!result.error) revalidateSessionInteractionPaths();
    return result;
  }
);

export const deleteComment = gateway.action.authed(
  { name: "social.delete-comment", input: deleteCommentInput },
  async ({ user, input }) => {
    const result = await deleteCommentCommand(user.id, input.commentId);
    if (!result.error) revalidateSessionInteractionPaths();
    return result;
  }
);
