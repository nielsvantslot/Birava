import type { IDirectUploadCoordinator } from "../adapters/IDirectUploadCoordinator";
import type { IImageProcessor } from "./IImageProcessor";
import type { IStorageAdapter } from "../adapters/IStorageAdapter";

export interface PhotoUploadServiceConfig {
  readonly storage: IStorageAdapter;
  /** The resize/strip/re-encode strategy — see `SharpImageProcessor` for the default (sharp-based) one. */
  readonly imageProcessor: IImageProcessor;
  /** Enables the browser-direct upload path (`createDirectUploadToken`/`finalizeDirectUpload`). Omit if the storage backend has no such capability (e.g. local disk). */
  readonly directUpload?: IDirectUploadCoordinator;
  /** Rejects uploads larger than this, in bytes — applies to both upload paths. */
  readonly maxUploadBytes: number;
  /**
   * Where a given owner's photos live, e.g. `(userId) => `photos/${userId}``.
   * Doubles as the ownership check on delete and on direct-upload pathnames.
   */
  readonly keyPrefix: (ownerId: string) => string;
  /** @default ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"] */
  readonly allowedContentTypes?: string[];
}
