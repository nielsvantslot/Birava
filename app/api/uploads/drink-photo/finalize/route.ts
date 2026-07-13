import { PhotoUploadRouteFactory } from "@/modules/photo-upload/PhotoUploadRouteFactory";
import { drinkPhotoService } from "@/lib/photoUpload";
import { getCurrentUser } from "@/lib/auth/session";

export const POST = PhotoUploadRouteFactory.createFinalizeRoute<RouteContext<"/api/uploads/drink-photo/finalize">>(
  drinkPhotoService,
  async () => getCurrentUser()
);
