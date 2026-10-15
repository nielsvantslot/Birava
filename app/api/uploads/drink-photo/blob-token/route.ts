import { PhotoUploadRouteFactory } from "@/modules/photo-upload/PhotoUploadRouteFactory";
import { drinkPhotoService } from "@/modules/media/server/photoUpload";
import { getCurrentUser } from "@/modules/identity/server/session";

export const POST = PhotoUploadRouteFactory.createDirectUploadTokenRoute<RouteContext<"/api/uploads/drink-photo/blob-token">>(
  drinkPhotoService,
  async () => getCurrentUser()
);
