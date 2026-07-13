import { promises as fs } from "fs";
import path from "path";
import type { IStorageAdapter } from "./IStorageAdapter";
import type { LocalDiskStorageAdapterConfig } from "./LocalDiskStorageAdapterConfig";
import type { StoredFile } from "../Models";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/**
 * Dev/local-only backend — writes to the filesystem. Has no direct-upload
 * capability (there's no "direct" target other than this same server), so
 * pair it with `PhotoUploadServiceConfig.directUpload` left unset.
 */
export class LocalDiskStorageAdapter implements IStorageAdapter {
  constructor(private readonly config: LocalDiskStorageAdapterConfig) {}

  async put(key: string, file: File): Promise<{ url: string }> {
    const absolutePath = path.join(this.config.rootDir, key);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));
    return { url: `${this.config.publicPathPrefix}/${key}` };
  }

  async get(url: string): Promise<StoredFile | null> {
    const filePath = this.resolvePath(url);
    if (!filePath) return null;
    try {
      const buffer = await fs.readFile(filePath);
      const contentType = CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
      return { stream: this.toReadableStream(buffer), contentType };
    } catch {
      return null;
    }
  }

  async del(url: string): Promise<void> {
    const filePath = this.resolvePath(url);
    if (!filePath) return;
    try {
      await fs.unlink(filePath);
    } catch {
      // Keep delete idempotent if the file has already been removed.
    }
  }

  private resolvePath(url: string): string | null {
    const parsed = new URL(url, "http://localhost");
    const pathname = decodeURIComponent(parsed.pathname);
    if (!pathname.startsWith(this.config.publicPathPrefix)) return null;
    return path.join(this.config.rootDir, pathname.slice(this.config.publicPathPrefix.length));
  }

  /** Wraps an already-in-memory buffer as a single-chunk stream — no copy, `Buffer` is already a `Uint8Array`. */
  private toReadableStream(buffer: Buffer): ReadableStream<Uint8Array> {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(buffer);
        controller.close();
      },
    });
  }
}
