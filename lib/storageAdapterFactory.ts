import path from "path";
import { LocalDiskStorageAdapter } from "@/modules/photo-upload/adapters/LocalDiskStorageAdapter";
import { VercelBlobStorageAdapter } from "@/modules/photo-upload/adapters/VercelBlobStorageAdapter";
import { VercelBlobDirectUploadCoordinator } from "@/modules/photo-upload/adapters/VercelBlobDirectUploadCoordinator";
import type { IStorageAdapter } from "@/modules/photo-upload/adapters/IStorageAdapter";
import type { IDirectUploadCoordinator } from "@/modules/photo-upload/adapters/IDirectUploadCoordinator";
import { PRIVATE_BLOB_ACCESS } from "@/lib/blobAccess";

/**
 * The env-branching storage decision every composition root in this app
 * needs (lib/photoUpload.ts, lib/avatarPhoto.ts, lib/shareImageCache.ts) —
 * local disk in dev, private Vercel Blob in production/staging, with a
 * direct-upload coordinator wherever the backend supports one. Shared here
 * rather than duplicated per composition root — they're all the exact same
 * private-blob strategy through the same reusable modules/photo-upload
 * module, not independent concepts. Still deliberately app-level, not part
 * of the reusable module itself — see that module's README: which concrete
 * adapter to use for a given environment is an application decision, not the
 * reusable factory's.
 */
export class StorageAdapterFactory {
  static create(): IStorageAdapter {
    if (process.env.NODE_ENV === "production") {
      return new VercelBlobStorageAdapter({ access: PRIVATE_BLOB_ACCESS });
    }
    return new LocalDiskStorageAdapter({
      rootDir: path.join(process.cwd(), "public", "uploads"),
      publicPathPrefix: "/uploads",
    });
  }

  static createDirectUploadCoordinator(): IDirectUploadCoordinator | undefined {
    // Local disk has no direct-upload capability — only wire this up where it
    // exists. Without it, the raw file travels through the request body even
    // in production, where Vercel Functions cap that at ~4.5MB.
    return process.env.NODE_ENV === "production" ? new VercelBlobDirectUploadCoordinator() : undefined;
  }
}
