import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

type Body = {
  token?: unknown;
  password?: unknown;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!token) {
    return Response.json({ error: "Missing reset token." }, { status: 400 });
  }

  if (password.length < 8) {
    return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const user = await db.user.findFirst({ where: { passwordResetToken: token } });
  if (!user || !user.passwordResetExpires || user.passwordResetExpires.getTime() < Date.now()) {
    return Response.json({ error: "This reset link is invalid or expired." }, { status: 400 });
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

  return Response.json({ success: true });
}
