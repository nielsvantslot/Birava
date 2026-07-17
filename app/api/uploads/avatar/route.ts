import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { avatarPhotoService } from "@/lib/avatarPhoto";
import { updateProfileAvatar } from "@/lib/commands/userCommands";
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
    // Square-crops + re-encodes to WebP and stores publicly; then point the
    // user's avatarUrl at it. Every avatar read site already reads avatarUrl.
    const { url } = await avatarPhotoService.processAndStore(file, user.id);
    const result = await updateProfileAvatar(user.id, url);
    if (result.error) {
      return Response.json({ error: result.error } satisfies AvatarUploadResultDTO, { status: 500 });
    }
    revalidatePath("/profile");
    return Response.json({ url } satisfies AvatarUploadResultDTO);
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
