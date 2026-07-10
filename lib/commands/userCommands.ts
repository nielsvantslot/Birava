import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { ActionResultDTO, CreateUserDTO, UpdateProfileDTO } from "@/lib/dtos";

const PASSWORD_RESET_TTL_MS = 1000 * 60 * 30;

export async function createUser(input: CreateUserDTO): Promise<ActionResultDTO> {
  const username = input.username.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (username.length < 2 || username.length > 30) {
    return { error: "Username must be between 2 and 30 characters." };
  }

  if (!email) {
    return { error: "Email is required." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  try {
    const passwordHash = await hashPassword(password);
    await db.user.create({
      data: {
        email,
        username,
        passwordHash,
      },
    });
  } catch (createError) {
    const code =
      createError instanceof Prisma.PrismaClientKnownRequestError
        ? createError.code
        : null;

    if (code === "P2002") {
      const target =
        createError instanceof Prisma.PrismaClientKnownRequestError
          ? (createError.meta?.target as string[] | undefined)?.join(",") ?? ""
          : "";

      if (target.includes("username")) {
        return { error: "That username is already taken." };
      }

      if (target.includes("email")) {
        return { error: "An account with this email already exists." };
      }
    }

    return { error: "Failed to create account. Please try again." };
  }

  return {};
}

export async function requestPasswordReset(email: string, origin: string): Promise<{ resetUrl?: string }> {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return {};

  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
  await db.user.update({
    where: { id: user.id },
    data: { passwordResetToken: token, passwordResetExpires: expires },
  });

  return { resetUrl: `${origin}/reset-password?token=${token}` };
}

export async function resetPassword(token: string, password: string): Promise<ActionResultDTO> {
  const user = await db.user.findFirst({ where: { passwordResetToken: token } });
  if (!user || !user.passwordResetExpires || user.passwordResetExpires.getTime() < Date.now()) {
    return { error: "This reset link is invalid or expired." };
  }

  const passwordHash = await hashPassword(password);
  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });

  return {};
}

export async function updateProfileUsername(
  userId: string,
  input: UpdateProfileDTO
): Promise<ActionResultDTO> {
  const username = input.username.trim();

  try {
    await db.user.update({
      where: { id: userId },
      data: { username },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "unique constraint" };
    }
    return { error: "Failed to update username." };
  }

  return {};
}
