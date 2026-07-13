export interface ProcessingConfig {
  /** Longest edge, in px, images are downsized to (never upscaled). */
  readonly maxDimension: number;
  /** 1-100 encoder quality for the output format. */
  readonly quality: number;
  /** @default "webp" */
  readonly format?: "webp" | "jpeg";
  /** Tiny base64 data URI for a blurred placeholder, or `false` to skip it. */
  readonly lqip?: { readonly width: number; readonly quality: number } | false;
}
