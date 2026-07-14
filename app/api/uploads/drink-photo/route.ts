import { PhotoUploadRouteFactory } from "@/modules/photo-upload/PhotoUploadRouteFactory";
import { drinkPhotoService } from "@/lib/photoUpload";
import { getCurrentUser } from "@/lib/auth/session";

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
