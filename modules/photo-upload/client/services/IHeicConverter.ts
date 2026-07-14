/**
 * Client-side HEIC/HEIF detection + conversion to a decodable format.
 * Injected into `PhotoUploadPreparer` rather than called as a static
 * utility, so it follows the same DI discipline as the server-side
 * `IImageProcessor` — even though there's currently one browser-native
 * implementation, swapping the decode library shouldn't require editing
 * `PhotoUploadPreparer` itself.
 */
export interface IHeicConverter {
  isHeic(file: File): boolean;
  /** No-op (returns the original file) when it isn't HEIC. */
  toJpeg(file: File, quality?: number): Promise<Blob>;
}
