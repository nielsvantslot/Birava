import { PhotoUploadError } from "./PhotoUploadError";

/** `createDirectUploadToken` was called on a service configured without an `IDirectUploadCoordinator` — `finalizeDirectUpload` doesn't need one, it only processes whatever raw upload already exists. */
export class DirectUploadNotConfiguredError extends PhotoUploadError {}
