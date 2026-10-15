import { PhotoUploadRouteFactory } from "@/modules/photo-upload/PhotoUploadRouteFactory";
import { avatarPhotoService } from "@/modules/media/server/avatarPhoto";
import { getCurrentUser } from "@/modules/identity/server/session";

export const POST = PhotoUploadRouteFactory.createDirectUploadTokenRoute<RouteContext<"/api/uploads/avatar/blob-token">>(
  avatarPhotoService,
  async () => getCurrentUser()
);
