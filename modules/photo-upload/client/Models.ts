import type { IDirectUploadTransport } from "./services/IDirectUploadTransport";

export interface DirectUploadEndpoints {
  readonly mode: "direct";
  /** Route created with `PhotoUploadRouteFactory.createDirectUploadTokenRoute`. */
  readonly tokenUrl: string;
  /** Route created with `PhotoUploadRouteFactory.createFinalizeRoute`. */
  readonly finalizeUrl: string;
  /** Must match the service's `keyPrefix(ownerId)` for this caller. */
  readonly keyPrefix: string;
  /** Must match the service's storage adapter access mode. @default "private" */
  readonly access?: "public" | "private";
  /** @default new VercelBlobDirectUploadTransport() — swap for a different provider's transport. */
  readonly transport?: IDirectUploadTransport;
}

export interface ServerUploadEndpoints {
  readonly mode: "server";
  /** Route created with `PhotoUploadRouteFactory.createUploadRoute`. */
  readonly uploadUrl: string;
}

/** `previewUrl` is null when no decodable preview could be produced (e.g. HEIC conversion failed). */
export type PreparedPhoto = { readonly file: File; readonly previewUrl: string | null };
