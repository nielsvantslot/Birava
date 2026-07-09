import { requestPasswordReset } from "@/lib/commands/userCommands";
import { JsonSerializer } from "@/lib/http/jsonSerializer";
import { RequestPasswordResetDTO } from "@/lib/dtos";

export async function POST(request: Request) {
  const input = await JsonSerializer.deserialize(request, RequestPasswordResetDTO);
  if (!input) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = input.email.trim().toLowerCase();
  if (!email) {
    return Response.json({ error: "Email is required." }, { status: 400 });
  }

  // In local/dev we return the reset link so the UX remains testable without an email provider.
  const { resetUrl } = await requestPasswordReset(email, new URL(request.url).origin);

  return Response.json(resetUrl ? { success: true, resetUrl } : { success: true });
}
