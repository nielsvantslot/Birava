import { createUserSession } from "@/lib/auth/session";
import { JsonSerializer } from "@/lib/http/jsonSerializer";
import { verifyCredentials } from "@/lib/queries/userQueries";
import { LoginDTO } from "@/lib/dtos";

export async function POST(request: Request) {
  const input = await JsonSerializer.deserialize(request, LoginDTO);
  if (!input) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!email || !password) {
    return Response.json({ error: "Email and password are required." }, { status: 400 });
  }

  const userId = await verifyCredentials(email, password);
  if (!userId) {
    return Response.json({ error: "Invalid email or password." }, { status: 401 });
  }

  await createUserSession(userId);
  return Response.json({ success: true });
}
