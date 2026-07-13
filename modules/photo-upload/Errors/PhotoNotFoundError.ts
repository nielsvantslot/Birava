import { PhotoUploadError } from "./PhotoUploadError";

/** No stored photo exists at the given URL — a direct upload that was never finalized, or a stale reference. */
export class PhotoNotFoundError extends PhotoUploadError {}
