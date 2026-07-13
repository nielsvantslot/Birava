import { PhotoUploadService } from "./PhotoUploadService";
import type { PhotoUploadServiceConfig } from "./PhotoUploadServiceConfig";
import type { IPhotoUploadService } from "./IPhotoUploadService";

/**
 * Encapsulates construction of a `PhotoUploadService` and returns it typed
 * as `IPhotoUploadService`, so callers depend on the abstraction rather than
 * the concrete class. Deliberately does NOT decide which concrete
 * `IStorageAdapter`/`IImageProcessor`/`IDirectUploadCoordinator` to use for a
 * given environment — that's an application concern for the project's own
 * composition root (e.g. `lib/photoUpload.ts`), not something this reusable
 * factory should hardcode.
 */
export class PhotoUploadServiceFactory {
  static create(config: PhotoUploadServiceConfig): IPhotoUploadService {
    return new PhotoUploadService(config);
  }
}
