/**
 * Base of this module's exception hierarchy. Catch this to handle any
 * expected, photo-upload-specific failure uniformly (e.g. mapping to a 400
 * response); catch a specific subclass when the failure reason itself
 * matters to the caller.
 */
export abstract class PhotoUploadError extends Error {}
