export interface CompressConfig {
  /** Longest edge, in px, the image is downsized to (never upscaled). */
  readonly maxDimension: number;
  /** 0-1 JPEG encoder quality. */
  readonly quality: number;
  /**
   * Files at or under this size skip the lossy resize/re-encode entirely —
   * the server re-encodes every upload exactly once regardless, so
   * compressing an already-reasonably-sized photo just stacks a second
   * lossy pass for no benefit.
   * @default 3 * 1024 * 1024 (3MB)
   */
  readonly skipIfSmallerThanBytes?: number;
}
