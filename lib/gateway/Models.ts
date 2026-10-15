import type { ZodType, z } from "zod";

/** A fixed-window limit. `scope` picks what is counted: the caller's IP or the signed-in user. */
export type RateLimitSpec = {
  /** Part of the bucket key, for example "login" gives "login:<ip>". */
  bucket: string;
  limit: number;
  windowMs: number;
  scope: "ip" | "user";
  /** Shown to the caller when the limit is hit. */
  message?: string;
};

/** Infers a schema's parsed type, or undefined when there is no schema. */
export type Infer<S extends ZodType | undefined> = S extends ZodType ? z.output<S> : undefined;

/** The parsed type of one input part ("body", "query", "form") of a route config, or undefined when the config has none. */
export type Part<S, K extends string> = S extends Record<K, infer V> ? (V extends ZodType ? z.output<V> : undefined) : undefined;

/** Infers what a caller may pass in for a schema (before defaults and transforms). */
export type InferInput<S extends ZodType | undefined> = S extends ZodType ? z.input<S> : undefined;

/** Next's route context: params arrive as a promise. */
export type RouteContextLike = { params: Promise<Record<string, string | string[] | undefined>> };
