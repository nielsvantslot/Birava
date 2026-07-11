import { requireUser } from "@/lib/auth/requireUser";
import { removeDrinkPhotoByUrl, saveDrinkPhoto } from "@/lib/storage";
import { normalizeUploadedPhoto } from "@/lib/storage/heic";
import { InvalidPhotoError, processUploadedPhoto } from "@/lib/storage/processPhoto";

type DeleteBody = {
  photoUrl?: unknown;
};

export const POST = requireUser<RouteContext<"/api/uploads/drink-photo">>(async (request, user) => {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file provided." }, { status: 400 });
  }

  let processed: Awaited<ReturnType<typeof processUploadedPhoto>>;
  try {
    const normalized = await normalizeUploadedPhoto(file);
    processed = await processUploadedPhoto(normalized);
  } catch (error) {
    const message = error instanceof InvalidPhotoError
      ? error.message
      : "Couldn't read that photo. Try a different file.";
    return Response.json({ error: message }, { status: 400 });
  }

  const publicUrl = await saveDrinkPhoto(user.id, processed.file);
  return Response.json({ publicUrl, lqip: processed.lqip });
});

export const DELETE = requireUser<RouteContext<"/api/uploads/drink-photo">>(async (request, user) => {
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
      await removeDrinkPhotoByUrl(photoUrl);
    }
  }

  return Response.json({ success: true });
});
