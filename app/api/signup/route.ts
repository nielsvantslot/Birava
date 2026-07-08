import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

type SignupPayload = {
  username?: unknown;
  email?: unknown;
  password?: unknown;
};

export async function POST(request: Request) {
  let body: SignupPayload;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (username.length < 2 || username.length > 30) {
    return Response.json(
      { error: "Username must be between 2 and 30 characters." },
      { status: 400 }
    );
  }

  if (!email) {
    return Response.json({ error: "Email is required." }, { status: 400 });
  }

  if (password.length < 8) {
    return Response.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
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
        return Response.json({ error: "That username is already taken." }, { status: 400 });
      }

      if (target.includes("email")) {
        return Response.json({ error: "An account with this email already exists." }, { status: 400 });
      }
    }

    return Response.json({ error: "Failed to create account. Please try again." }, { status: 400 });
  }

  return Response.json({ success: true });
}
