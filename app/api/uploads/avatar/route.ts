import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { storeAvatar } from "@/lib/commands/userCommands";
import { PhotoUploadError } from "@/modules/photo-upload/Errors/PhotoUploadError";
import { AvatarUploadResultDTO } from "@/lib/dtos";

// sharp + storage need Node, not edge.
export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Not signed in." } satisfies AvatarUploadResultDTO, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No image provided." } satisfies AvatarUploadResultDTO, { status: 400 });
  }

  try {
    const result = await storeAvatar(user.id, file);
    if (result.error) {
      return Response.json(result, { status: 500 });
    }
    revalidatePath("/profile");
    return Response.json(result);
  } catch (e) {
    if (e instanceof PhotoUploadError) {
      return Response.json({ error: e.message } satisfies AvatarUploadResultDTO, { status: 400 });
    }
    return Response.json(
      { error: "Couldn't upload that image. Try another." } satisfies AvatarUploadResultDTO,
      { status: 500 }
    );
  }
}
