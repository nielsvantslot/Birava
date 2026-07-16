/**
 * The auth routes' JSON response contract (`/api/auth/login`, `/api/signup`):
 * `success` on the happy path, `error` with a user-facing message otherwise.
 * Shared so the routes and their client callers agree on the shape.
 */
export class AuthResultDTO {
  declare success?: boolean;
  declare error?: string;
}
