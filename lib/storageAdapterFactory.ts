import path from "path";
import { LocalDiskStorageAdapter } from "@/modules/photo-upload/adapters/LocalDiskStorageAdapter";
import { VercelBlobStorageAdapter } from "@/modules/photo-upload/adapters/VercelBlobStorageAdapter";
import type { IStorageAdapter } from "@/modules/photo-upload/adapters/IStorageAdapter";

/**
 * The env-branching storage backend decision every composition root in this
 * app needs (lib/photoUpload.ts, lib/shareImageCache.ts) — local disk in dev,
 * private Vercel Blob in production/staging. Shared here rather than
 * duplicated per composition root. Still deliberately app-level, not part of
 * the reusable modules/photo-upload module — see that module's README:
 * which concrete adapter to use for a given environment is an application
 * decision, not the reusable factory's.
 */
export class StorageAdapterFactory {
  static create(): IStorageAdapter {
    if (process.env.NODE_ENV === "production") {
      return new VercelBlobStorageAdapter({ access: "private" });
    }
    return new LocalDiskStorageAdapter({
      rootDir: path.join(process.cwd(), "public", "uploads"),
      publicPathPrefix: "/uploads",
    });
  }
}
