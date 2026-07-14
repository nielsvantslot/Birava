import { PhotoUploadError } from "./PhotoUploadError";

/** The given URL/pathname doesn't belong to the caller's own `keyPrefix(ownerId)` namespace. */
export class InvalidUploadError extends PhotoUploadError {}
