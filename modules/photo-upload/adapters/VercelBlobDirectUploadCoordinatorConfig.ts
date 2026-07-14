export interface VercelBlobDirectUploadCoordinatorConfig {
  /** Defaults to `process.env.BLOB_READ_WRITE_TOKEN`. */
  readonly token?: string;
}
