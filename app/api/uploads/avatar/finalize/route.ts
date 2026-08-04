import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { finalizeAvatarUpload } from "@/lib/commands/userCommands";
import { PhotoUploadError } from "@/modules/photo-upload/Errors/PhotoUploadError";
import type { Json } from "@/modules/photo-upload/Models";
import { AvatarUploadResultDTO } from "@/lib/dtos";

// sharp + storage need Node, not edge.
export const runtime = "nodejs";

// Hand-rolled rather than PhotoUploadRouteFactory.createFinalizeRoute — that
// factory only knows the generic store/return-url contract, not this app's
// avatar-specific side effect of also pointing User.avatarUrl at the result.
// Mirrors ../route.ts's plain-upload path, which needs the exact same step.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Not signed in." } satisfies AvatarUploadResultDTO, { status: 401 });
  }

  const body: Json = await request.json().catch(() => null);
  const rawUrl = typeof body === "object" && body !== null && !Array.isArray(body) && typeof body.url === "string" ? body.url : "";
  if (!rawUrl) {
    return Response.json({ error: "Invalid upload." } satisfies AvatarUploadResultDTO, { status: 400 });
  }

  if (request.signal.aborted) {
    return Response.json({ error: "Upload cancelled." } satisfies AvatarUploadResultDTO, { status: 499 });
  }

  try {
    const result = await finalizeAvatarUpload(user.id, rawUrl);
    if (result.error) {
      return Response.json(result, { status: 500 });
    }
    revalidatePath("/profile");
    return Response.json(result);
  } catch (e) {
    const message = e instanceof PhotoUploadError ? e.message : "Failed to process photo.";
    return Response.json({ error: message } satisfies AvatarUploadResultDTO, { status: 400 });
  }
}
