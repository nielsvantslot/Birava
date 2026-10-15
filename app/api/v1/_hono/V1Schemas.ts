import { z } from "zod";
import { ERROR_CODES } from "@/lib/gateway/ErrorCode";
import { DRINK_TYPES } from "@/lib/types";

/** The one error shape every failing /api/v1 call returns. */
export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    fields: z.record(z.string(), z.array(z.string())).optional(),
  }),
});

/** The standard failure responses, by status, for use in a route's `responses`. */
export class V1Responses {
  private static readonly DESCRIPTIONS: Record<number, string> = {
    400: "The request was invalid or the operation was refused",
    401: "No valid session or token",
    403: "Not allowed",
    404: "Not found",
    409: "Conflict, or an Idempotency-Key problem",
    429: "Rate limited; see Retry-After",
  };

  static errors<S extends 400 | 401 | 403 | 404 | 409 | 429>(...statuses: S[]) {
    const entries = statuses.map((status) => [
      status,
      { description: V1Responses.DESCRIPTIONS[status]!, content: { "application/json": { schema: errorEnvelopeSchema } } },
    ]);
    // Typed by status (not an index signature), so a route's responses keep their literal status keys.
    return Object.fromEntries(entries) as Record<S, { description: string; content: { "application/json": { schema: typeof errorEnvelopeSchema } } }>;
  }
}

export const userSummarySchema = z.object({
  id: z.string(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
  isDeveloper: z.boolean(),
});

export const meSchema = z.object({
  id: z.string(),
  email: z.string(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
  createdAt: z.string(),
  isDeveloper: z.boolean(),
});

export const checkinSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  session_id: z.string(),
  drink_name: z.string().nullable(),
  drink_type: z.enum(DRINK_TYPES),
  venue: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  photo_url: z.string().nullable(),
  photo_lqip: z.string().nullable(),
  created_at: z.string(),
});

export const sessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
  isDeveloper: z.boolean(),
  start: z.string(),
  end: z.string(),
  name: z.string().nullable(),
  checkins: z.array(checkinSchema),
  venues: z.array(z.string()),
  types: z.array(z.string()),
  photoIds: z.array(z.string()),
});

export const feedPageSchema = z.object({
  sessions: z.array(sessionSchema),
  cheers: z.array(z.tuple([z.string(), z.object({ count: z.number(), on: z.boolean() })])),
  commentCounts: z.array(z.tuple([z.string(), z.number()])),
  nextCursor: z.object({ endedAt: z.string(), id: z.string() }).nullable(),
});

/** A path parameter that is an id. */
export const idParam = z.object({ id: z.guid() });
