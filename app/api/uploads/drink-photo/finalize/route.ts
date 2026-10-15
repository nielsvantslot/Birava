import { PhotoUploadRouteHandlers } from "@/modules/photo-upload/PhotoUploadRouteHandlers";
import { drinkPhotoService } from "@/modules/media/server/photoUpload";
import { UploadErrorMapper } from "@/modules/media/server/UploadErrorMapper";
import { uploadUrlInput } from "@/modules/media/contract/uploadContract";
import { gateway } from "@/modules/identity/server/gateway";

export const POST = gateway.route.authed(
  { name: "uploads.drink-photo.finalize", body: uploadUrlInput, invalidMessage: "Invalid upload." },
  ({ request, user, input }) =>
    UploadErrorMapper.run(() =>
      PhotoUploadRouteHandlers.finalize(drinkPhotoService, { url: input.body.url, request, ownerId: user.id })
    )
);
