/**
 * An expected failure of an upload request, already worded for the caller.
 * Thrown by `PhotoUploadRouteHandlers`; the host maps `status` and `message`
 * onto whatever error shape its routes use.
 */
export class PhotoUploadRouteError extends Error {
  constructor(
    /** 400: the request or photo was rejected. 499: the caller disconnected first. */
    readonly status: 400 | 499,
    message: string
  ) {
    super(message);
    this.name = "PhotoUploadRouteError";
  }
}
