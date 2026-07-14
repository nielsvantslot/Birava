/** The client-side view of an upload route's JSON response — success or failure, never both. */
export type PhotoUploadResultDto = { readonly url: string; readonly lqip: string | null } | { readonly error: string };
