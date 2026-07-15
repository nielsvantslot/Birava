import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { ActionResultDTO, CreateUserDTO, UpdateProfileDTO } from "@/lib/dtos";

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
