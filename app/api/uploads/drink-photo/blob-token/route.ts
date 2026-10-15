import { PhotoUploadRouteHandlers } from "@/modules/photo-upload/PhotoUploadRouteHandlers";
import { drinkPhotoService } from "@/modules/media/server/photoUpload";
import { UploadErrorMapper } from "@/modules/media/server/UploadErrorMapper";
import { directUploadTokenInput } from "@/modules/media/contract/uploadContract";
import { gateway } from "@/modules/identity/server/gateway";

export const POST = gateway.route.authed(
  { name: "uploads.drink-photo.token", body: directUploadTokenInput },
  ({ request, user, input }) =>
    UploadErrorMapper.run(() =>
      PhotoUploadRouteHandlers.createDirectUploadToken(drinkPhotoService, { requestBody: input.body, request, ownerId: user.id })
    )
);
