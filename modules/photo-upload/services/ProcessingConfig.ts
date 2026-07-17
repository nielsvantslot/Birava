export interface ProcessingConfig {
  /** Longest edge, in px, images are downsized to (never upscaled). */
  readonly maxDimension: number;
  /**
   * How the image fills the maxDimension box. "inside" (default) preserves
   * aspect ratio within the box (check-in photos); "cover" center-crops to a
   * square maxDimension×maxDimension (avatars). @default "inside"
   */
  readonly fit?: "inside" | "cover";
  /** 1-100 encoder quality for the output format. */
  readonly quality: number;
  /** @default "webp" */
  readonly format?: "webp" | "jpeg";
  /** Tiny base64 data URI for a blurred placeholder, or `false` to skip it. */
  readonly lqip?: { readonly width: number; readonly quality: number } | false;
}
