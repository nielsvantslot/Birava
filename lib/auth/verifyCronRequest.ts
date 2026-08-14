import { timingSafeEqual } from "crypto";

/**
 * Guards every app/api/cron/* route. A plain `!==` string comparison here
 * leaks timing information proportional to how many leading characters of
 * the guess match CRON_SECRET — a long-lived, unrotated shared secret is
 * exactly the case that theoretical remote-timing attack is worth closing
 * for. timingSafeEqual requires equal-length buffers, so a length mismatch
 * is checked separately first (constant-time comparison of different
 * lengths isn't meaningful anyway — there's nothing to compare byte-for-byte).
 */
export function verifyCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  const headerBuf = Buffer.from(header);
  const expectedBuf = Buffer.from(expected);
  if (headerBuf.length !== expectedBuf.length) return false;

  return timingSafeEqual(headerBuf, expectedBuf);
}
