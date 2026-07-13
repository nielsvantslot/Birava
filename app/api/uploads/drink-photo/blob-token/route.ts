import { PhotoUploadRouteFactory } from "@/modules/photo-upload/PhotoUploadRouteFactory";
import { drinkPhotoService } from "@/lib/photoUpload";
import { getCurrentUser } from "@/lib/auth/session";

export const POST = PhotoUploadRouteFactory.createDirectUploadTokenRoute<RouteContext<"/api/uploads/drink-photo/blob-token">>(
  drinkPhotoService,
  async () => getCurrentUser()
);
