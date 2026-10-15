import { PhotoUploadRouteHandlers } from "@/modules/photo-upload/PhotoUploadRouteHandlers";
import { drinkPhotoService } from "@/modules/media/server/photoUpload";
import { UploadErrorMapper } from "@/modules/media/server/UploadErrorMapper";
import { uploadFileForm, uploadUrlInput } from "@/modules/media/contract/uploadContract";
import { gateway } from "@/modules/identity/server/gateway";

// Local dev only (disk storage has no direct-upload capability) — production
// uploads straight to Blob via blob-token/ + finalize/.
export const POST = gateway.route.authed(
  { name: "uploads.drink-photo.create", form: uploadFileForm, invalidMessage: "No file provided." },
  ({ request, user, input }) =>
    UploadErrorMapper.run(() =>
      PhotoUploadRouteHandlers.upload(drinkPhotoService, { file: input.form.file, request, ownerId: user.id })
    )
);

export const DELETE = gateway.route.authed(
  { name: "uploads.drink-photo.delete", body: uploadUrlInput, invalidMessage: "Invalid request body." },
  ({ user, input }) =>
    UploadErrorMapper.run(() => PhotoUploadRouteHandlers.remove(drinkPhotoService, { url: input.body.url, ownerId: user.id }))
);
