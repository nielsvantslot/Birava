import { PhotoUploadRouteFactory } from "@/modules/photo-upload/PhotoUploadRouteFactory";
import { drinkPhotoService } from "@/modules/media/server/photoUpload";
import { getCurrentUser } from "@/modules/identity/server/session";

// Local dev only (disk storage has no direct-upload capability) — production
// uploads straight to Blob via blob-token/ + finalize/.
export const POST = PhotoUploadRouteFactory.createUploadRoute<RouteContext<"/api/uploads/drink-photo">>(
  drinkPhotoService,
  async () => getCurrentUser()
);

export const DELETE = PhotoUploadRouteFactory.createDeleteRoute<RouteContext<"/api/uploads/drink-photo">>(
  drinkPhotoService,
  async () => getCurrentUser()
);
