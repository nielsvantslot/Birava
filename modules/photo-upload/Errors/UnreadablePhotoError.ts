import { PhotoUploadError } from "./PhotoUploadError";

/** sharp (or the HEIC decoder) couldn't decode the input as an image. */
export class UnreadablePhotoError extends PhotoUploadError {}
