import type { StoredFile } from "../Models";
import type { UploadResultDto } from "../Dto/UploadResultDto";

/** Input to `IPhotoUploadService.createDirectUploadToken` — named once here so the interface and its implementation can't drift apart. */
export interface CreateDirectUploadTokenInput {
  readonly requestBody: unknown;
  readonly request: Request;
  readonly ownerId: string;
}

/**
 * The photo-upload feature's public contract. Consumers (route handlers,
 * scripts) should depend on this interface, not the concrete
 * `PhotoUploadService` class — obtained via `PhotoUploadServiceFactory.create(...)`.
 */
export interface IPhotoUploadService {
  /** Classic single-request multipart upload: validate/process → store. */
  processAndStore(file: File, ownerId: string): Promise<UploadResultDto>;
  /** Deletes a photo, refusing to touch anything outside the owner's namespace. */
  remove(url: string, ownerId: string): Promise<void>;
  /** No ownership check — callers authorize reads themselves (e.g. viewing another user's public photo). */
  read(url: string): Promise<StoredFile | null>;
  /** Stores an already-processed file as-is (no validation/processing). */
  store(file: File, ownerId: string): Promise<UploadResultDto>;
  /** Re-runs processing over a photo that's already in storage (e.g. a migration/backfill). */
  reprocessStored(url: string, ownerId: string): Promise<UploadResultDto>;
  /** Issues a browser-direct upload token. Throws if no direct-upload coordinator was configured. */
  createDirectUploadToken(input: CreateDirectUploadTokenInput): Promise<unknown>;
  /** The follow-up to a direct upload: fetch the raw bytes back, process, store, clean up. */
  finalizeDirectUpload(rawUrl: string, ownerId: string): Promise<UploadResultDto>;
  readonly supportsDirectUpload: boolean;
}
