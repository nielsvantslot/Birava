import { resetPassword } from "@/lib/commands/userCommands";
import { JsonSerializer } from "@/lib/http/jsonSerializer";
import { ResetPasswordDTO } from "@/lib/dtos";

export async function POST(request: Request) {
  const input = await JsonSerializer.deserialize(request, ResetPasswordDTO);
  if (!input) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const token = input.token.trim();
  const password = input.password;

  if (!token) {
    return Response.json({ error: "Missing reset token." }, { status: 400 });
  }

  if (password.length < 8) {
    return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const result = await resetPassword(token, password);
  if (result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({ success: true });
}
