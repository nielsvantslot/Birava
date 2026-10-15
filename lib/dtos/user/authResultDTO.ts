/**
 * The auth routes' JSON response contract (`/api/auth/login`, `/api/signup`):
 * `success` on the happy path. Failures are the gateway error envelope
 * (lib/gateway/ErrorEnvelope.ts), read with `ErrorEnvelope.messageFrom`.
 */
export class AuthResultDTO {
  declare success?: boolean;
  /** Set when logging in cancelled a pending GDPR-erasure request (see app/api/auth/login/route.ts) — the client shows a toast about it instead of staying silent. */
  declare cancelledDeletion?: boolean;
}
