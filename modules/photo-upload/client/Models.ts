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
  /**
   * A `PhotoUploadRouteFactory.createUploadRoute` route to fall back to if the
   * direct upload fails — the direct path travels straight from this browser
   * to storage, over a network the app has no control over, whereas this
   * fallback only needs the browser to reach this app's own server (which the
   * direct token request already just proved it can) and lets the server do
   * the actual storage write itself. Confirmed live: a network that could
   * reach the app fine but silently couldn't reach the storage provider's own
   * domain left every direct upload attempt hanging indefinitely with no
   * server-side signal at all to react to. Omit to disable the fallback (e.g.
   * if the caller's server route can't accept the request body size a direct
   * upload was specifically added to route around).
   */
  readonly fallbackUploadUrl?: string;
}

export interface ServerUploadEndpoints {
  readonly mode: "server";
  /** Route created with `PhotoUploadRouteFactory.createUploadRoute`. */
  readonly uploadUrl: string;
}

/** `previewUrl` is null when no decodable preview could be produced (e.g. HEIC conversion failed). */
export type PreparedPhoto = { readonly file: File; readonly previewUrl: string | null };
