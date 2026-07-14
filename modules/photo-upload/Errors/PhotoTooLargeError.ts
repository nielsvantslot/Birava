import { PhotoUploadError } from "./PhotoUploadError";

/** The input file exceeds the configured `maxUploadBytes`/`maxInputBytes`. */
export class PhotoTooLargeError extends PhotoUploadError {}
