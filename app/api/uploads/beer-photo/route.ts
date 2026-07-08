import { getCurrentUser } from "@/lib/auth/session";
import { saveBeerPhoto, removeBeerPhotoByUrl } from "@/lib/storage/local";

type DeleteBody = {
  photoUrl?: unknown;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file provided." }, { status: 400 });
  }

  const publicUrl = await saveBeerPhoto(user.id, file);
  return Response.json({ publicUrl });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  let body: DeleteBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const photoUrl = typeof body.photoUrl === "string" ? body.photoUrl : "";
  if (photoUrl) {
    const url = new URL(photoUrl, "http://localhost");
    if (url.pathname.startsWith(`/uploads/beer-photos/${user.id}/`)) {
      await removeBeerPhotoByUrl(photoUrl);
    }
  }

  return Response.json({ success: true });
}
