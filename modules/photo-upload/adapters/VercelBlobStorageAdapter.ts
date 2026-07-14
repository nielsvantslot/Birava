import { del, get, put } from "@vercel/blob";
import type { IStorageAdapter } from "./IStorageAdapter";
import type { VercelBlobStorageAdapterConfig } from "./VercelBlobStorageAdapterConfig";
import type { StoredFile } from "../Models";

/** Production storage backend — Vercel Blob's put/get/del, nothing more. */
export class VercelBlobStorageAdapter implements IStorageAdapter {
  private readonly access: "public" | "private";

  constructor(private readonly config: VercelBlobStorageAdapterConfig = {}) {
    this.access = config.access ?? "private";
  }

  async put(key: string, file: File): Promise<{ url: string }> {
    const blob = await put(key, file, { access: this.access, addRandomSuffix: false, token: this.config.token });
    return { url: blob.url };
  }

  async get(url: string): Promise<StoredFile | null> {
    try {
      const result = await get(url, { access: this.access, token: this.config.token });
      if (!result || !result.stream) return null;
      return { stream: result.stream, contentType: result.blob.contentType ?? "application/octet-stream" };
    } catch {
      // Matches LocalDiskStorageAdapter: not-found (or any read failure) resolves to null, never throws.
      return null;
    }
  }

  async del(url: string): Promise<void> {
    try {
      await del(url, { token: this.config.token });
    } catch {
      // Keep delete idempotent if the blob has already been removed.
    }
  }
}
