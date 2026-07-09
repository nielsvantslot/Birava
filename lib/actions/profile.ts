"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

export async function updateProfileUsername(username: string): Promise<{ error?: { message: string } }> {
  const user = await getCurrentUser();
  if (!user) return { error: { message: "Not authenticated" } };

  try {
    await db.user.update({
      where: { id: user.id },
      data: { username: username.trim() },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: { message: "unique constraint" } };
    }
    return { error: { message: "Failed to update username." } };
  }

  revalidatePath("/profile");
  revalidatePath(`/profile/${username.trim()}`);
  return {};
}
