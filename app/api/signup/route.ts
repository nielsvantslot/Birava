import { createUser } from "@/lib/commands/userCommands";
import { JsonSerializer } from "@/lib/http/jsonSerializer";
import { CreateUserDTO } from "@/lib/dtos";

export async function POST(request: Request) {
  const input = await JsonSerializer.deserialize(request, CreateUserDTO);
  if (!input) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const result = await createUser(input);
  if (result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({ success: true });
}
