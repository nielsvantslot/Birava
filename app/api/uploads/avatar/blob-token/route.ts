import { PhotoUploadRouteFactory } from "@/modules/photo-upload/PhotoUploadRouteFactory";
import { avatarPhotoService } from "@/lib/avatarPhoto";
import { getCurrentUser } from "@/lib/auth/session";

export const POST = PhotoUploadRouteFactory.createDirectUploadTokenRoute<RouteContext<"/api/uploads/avatar/blob-token">>(
  avatarPhotoService,
  async () => getCurrentUser()
);
