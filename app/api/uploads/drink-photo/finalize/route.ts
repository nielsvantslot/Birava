import { PhotoUploadRouteFactory } from "@/modules/photo-upload/PhotoUploadRouteFactory";
import { drinkPhotoService } from "@/modules/media/server/photoUpload";
import { getCurrentUser } from "@/modules/identity/server/session";

export const POST = PhotoUploadRouteFactory.createFinalizeRoute<RouteContext<"/api/uploads/drink-photo/finalize">>(
  drinkPhotoService,
  async () => getCurrentUser()
);
