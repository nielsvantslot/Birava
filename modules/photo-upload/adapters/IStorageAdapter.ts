import type { StoredFile } from "../Models";

/**
 * Where bytes physically live. Implement this for whatever backs storage in
 * a given project — see `adapters/LocalDiskStorageAdapter.ts` and
 * `adapters/VercelBlobStorageAdapter.ts` for the two provided implementations.
 */
export interface IStorageAdapter {
  put(key: string, file: File): Promise<{ url: string }>;
  get(url: string): Promise<StoredFile | null>;
  del(url: string): Promise<void>;
}
