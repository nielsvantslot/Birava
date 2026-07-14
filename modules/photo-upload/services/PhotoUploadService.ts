import crypto from "crypto";
import path from "path";
import { HeicFileDetector } from "../HeicFileDetector";
import { StreamBufferConverter } from "../StreamBufferConverter";
import { DirectUploadNotConfiguredError } from "../Errors/DirectUploadNotConfiguredError";
import { InvalidUploadError } from "../Errors/InvalidUploadError";
import { PhotoNotFoundError } from "../Errors/PhotoNotFoundError";
import type { ProcessedImage, StoredFile } from "../Models";
import type { UploadResultDto } from "../Dto/UploadResultDto";
import type { CreateDirectUploadTokenInput, IPhotoUploadService } from "./IPhotoUploadService";
import type { PhotoUploadServiceConfig } from "./PhotoUploadServiceConfig";

// Derived from HeicFileDetector.HEIC_MIME_TYPES (not hand-duplicated) — the
// direct-upload token's content-type allowlist must accept everything the
// pipeline's own HEIC detection recognizes, or a valid HEIC (e.g. an iPhone
// Live Photo) gets rejected before it ever reaches the server.
const DEFAULT_ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  ...HeicFileDetector.HEIC_MIME_TYPES,
];

/**
 * Orchestrates a storage adapter + image processor + optional direct-upload
 * coordinator + ownership convention into the operations a photo-upload
 * feature needs. Every collaborator is constructor-injected — this class has
 * no concrete dependency on sharp, heic-convert, Vercel Blob, or the
 * filesystem. Obtain an instance via `PhotoUploadServiceFactory.create(...)`
 * rather than constructing directly, and depend on `IPhotoUploadService` at
 * call sites. See `PhotoUploadRouteFactory.ts` for ready-made Next.js Route Handler wrappers.
 */
export class PhotoUploadService implements IPhotoUploadService {
  private readonly allowedContentTypes: string[];

  constructor(private readonly config: PhotoUploadServiceConfig) {
    this.allowedContentTypes = config.allowedContentTypes ?? DEFAULT_ALLOWED_CONTENT_TYPES;
  }

  get supportsDirectUpload(): boolean {
    return Boolean(this.config.directUpload);
  }

  async processAndStore(file: File, ownerId: string): Promise<UploadResultDto> {
    const processed = await this.config.imageProcessor.processUpload(file);
    const { url } = await this.store(processed.file, ownerId);
    return { url, lqip: processed.lqip };
  }

  async remove(url: string, ownerId: string): Promise<void> {
    if (!this.ownsUrl(url, ownerId)) return;
    await this.config.storage.del(url);
  }

  async read(url: string): Promise<StoredFile | null> {
    return this.config.storage.get(url);
  }

  async store(file: File, ownerId: string): Promise<UploadResultDto> {
    const ext = path.extname(file.name).slice(1) || "jpg";
    const key = `${this.config.keyPrefix(ownerId)}/${crypto.randomUUID()}.${ext}`;
    const { url } = await this.config.storage.put(key, file);
    return { url, lqip: null };
  }

  async createDirectUploadToken(input: CreateDirectUploadTokenInput): Promise<unknown> {
    if (!this.config.directUpload) {
      throw new DirectUploadNotConfiguredError("This service has no direct-upload coordinator configured.");
    }
    return this.config.directUpload.handleTokenRequest({
      requestBody: input.requestBody,
      request: input.request,
      maxUploadBytes: this.config.maxUploadBytes,
      allowedContentTypes: this.allowedContentTypes,
      validatePathname: async (pathname) => {
        if (!this.ownsPathname(pathname, input.ownerId)) {
          throw new InvalidUploadError("Invalid upload path.");
        }
      },
    });
  }

  async finalizeDirectUpload(rawUrl: string, ownerId: string): Promise<UploadResultDto> {
    if (!this.ownsUrl(rawUrl, ownerId)) {
      throw new InvalidUploadError("Invalid upload.");
    }
    const raw = await this.config.storage.get(rawUrl);
    if (!raw) throw new PhotoNotFoundError("Upload not found.");

    let processed: ProcessedImage;
    try {
      const buffer = await StreamBufferConverter.toBuffer(raw.stream);
      // Preserve the extension the direct-upload pathname was given (see
      // PhotoUploader.uploadDirect) — HEIC detection checks the filename
      // first precisely because contentType doesn't reliably survive as an
      // exact HEIC MIME string across the browser/Blob round trip. The base
      // URL fallback tolerates a storage adapter returning a relative URL
      // (e.g. local disk) even though direct upload is Blob-only today.
      const ext = path.extname(new URL(rawUrl, "http://localhost").pathname);
      const file = new File([Uint8Array.from(buffer)], `upload${ext}`, { type: raw.contentType });
      processed = await this.config.imageProcessor.processUpload(file);
    } finally {
      await this.config.storage.del(rawUrl);
    }

    const { url } = await this.store(processed.file, ownerId);
    return { url, lqip: processed.lqip };
  }

  async reprocessStored(url: string, ownerId: string): Promise<UploadResultDto> {
    const stored = await this.config.storage.get(url);
    if (!stored) throw new PhotoNotFoundError("Stored photo not found.");

    const buffer = await StreamBufferConverter.toBuffer(stored.stream);
    const processed = await this.config.imageProcessor.reprocessBuffer(buffer);
    const { url: newUrl } = await this.store(processed.file, ownerId);
    return { url: newUrl, lqip: processed.lqip };
  }

  /** Does this stored file's URL (e.g. `https://.../entries-photos/{userId}/{uuid}.webp`) belong to `ownerId`? */
  private ownsUrl(url: string, ownerId: string): boolean {
    return url.includes(`/${this.config.keyPrefix(ownerId)}/`);
  }

  /** Does this bare storage key/pathname (e.g. `entries-photos/{userId}/{uuid}.jpg`, no host or leading slash) belong to `ownerId`? */
  private ownsPathname(pathname: string, ownerId: string): boolean {
    return pathname.startsWith(`${this.config.keyPrefix(ownerId)}/`);
  }
}
