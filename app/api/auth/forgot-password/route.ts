import crypto from "crypto";
import { db } from "@/lib/db";

type Body = {
  email?: unknown;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email) {
    return Response.json({ error: "Email is required." }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { email } });
  if (user) {
    const token = crypto.randomUUID();
    const expires = new Date(Date.now() + 1000 * 60 * 30);
    await db.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpires: expires,
      },
    });

    // In local/dev we return the reset link so the UX remains testable without an email provider.
    return Response.json({
      success: true,
      resetUrl: `${new URL(request.url).origin}/reset-password?token=${token}`,
    });
  }

  return Response.json({ success: true });
}
