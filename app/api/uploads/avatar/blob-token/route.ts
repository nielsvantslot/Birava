import { PhotoUploadRouteHandlers } from "@/modules/photo-upload/PhotoUploadRouteHandlers";
import { avatarPhotoService } from "@/modules/media/server/avatarPhoto";
import { UploadErrorMapper } from "@/modules/media/server/UploadErrorMapper";
import { directUploadTokenInput } from "@/modules/media/contract/uploadContract";
import { gateway } from "@/modules/identity/server/gateway";

export const POST = gateway.route.authed(
  { name: "uploads.avatar.token", body: directUploadTokenInput },
  ({ request, user, input }) =>
    UploadErrorMapper.run(() =>
      PhotoUploadRouteHandlers.createDirectUploadToken(avatarPhotoService, { requestBody: input.body, request, ownerId: user.id })
    )
);
