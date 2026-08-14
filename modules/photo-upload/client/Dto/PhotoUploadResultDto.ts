/**
 * The client-side view of an upload route's JSON response — success or
 * failure, never both. `retryable` distinguishes a definitive server
 * rejection (bad format, oversized, auth failure — the same input will
 * fail again) from a transient one (network drop, timeout — worth trying
 * again later). Defaults to `true` where omitted so any caller not yet
 * reading it keeps today's "always requeue" behavior rather than silently
 * treating an unmarked error as permanent.
 */
export type PhotoUploadResultDto =
  | { readonly url: string; readonly lqip: string | null }
  | { readonly error: string; readonly retryable?: boolean };
