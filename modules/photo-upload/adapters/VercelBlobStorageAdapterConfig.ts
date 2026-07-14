export interface VercelBlobStorageAdapterConfig {
  /** @default "private" */
  readonly access?: "public" | "private";
  /** Defaults to `process.env.BLOB_READ_WRITE_TOKEN`. */
  readonly token?: string;
}
