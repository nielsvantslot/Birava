export interface LocalDiskStorageAdapterConfig {
  /** Absolute filesystem directory files are written under. */
  readonly rootDir: string;
  /** URL prefix files are served under (e.g. an app route serving `rootDir` statically). */
  readonly publicPathPrefix: string;
}
