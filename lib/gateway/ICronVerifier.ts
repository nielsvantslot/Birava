/** Decides whether a request carries the shared cron secret. */
export interface ICronVerifier {
  verify(request: Request): boolean;
}
