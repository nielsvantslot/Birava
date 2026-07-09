import { getCurrentUser } from '@/lib/auth/session';
import {
  removeBeerPhotoByUrl,
  saveBeerPhoto,
} from '@/lib/storage';

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
    if (url.pathname.includes(`/entries-photos/${user.id}/`)) {
      await removeBeerPhotoByUrl(photoUrl);
    }
  }

  return Response.json({ success: true });
}
