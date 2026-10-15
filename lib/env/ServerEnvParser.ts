import { z } from "zod";
import type { ServerEnvValues } from "@/lib/env/Models";

/**
 * Parses and validates the server's environment variables once, so a missing
 * or malformed variable fails at startup with a readable message instead of
 * at the first request that happens to need it.
 *
 * "Required" is keyed on VERCEL_ENV (set on every Vercel deployment), not
 * NODE_ENV: `next build` runs with NODE_ENV=production locally and in CI too,
 * where there is no Blob token or cron secret and none is needed.
 */
export class ServerEnvParser {
  private static readonly schema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    DATABASE_URL: z
      .string()
      .refine((v) => /^postgres(ql)?:\/\//.test(v), "must be a postgres:// or postgresql:// URL"),
    VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
    CRON_SECRET: z.string().min(1).optional(),
    BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
    VAPID_PUBLIC_KEY: z.string().min(1).optional(),
    VAPID_PRIVATE_KEY: z.string().min(1).optional(),
    VAPID_SUBJECT: z
      .string()
      .refine((v) => /^(mailto:|https:\/\/)/.test(v), "must start with mailto: or https://")
      .optional(),
  });

  /** Throws one Error listing every problem, never a partial result. */
  static parse(source: Record<string, string | undefined>): ServerEnvValues {
    // .env.example ships empty strings for optional keys, and some hosts
    // export unset vars as "" — treat those as absent.
    const cleaned = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ""));
    const result = ServerEnvParser.schema.safeParse(cleaned);
    // Cross-field rules run on the raw values rather than inside the schema:
    // zod skips refinements once the base shape has failed, which would hide
    // these problems until the first ones were fixed.
    const problems = [
      ...(result.success ? [] : result.error.issues.map((i) => `${i.path.join(".") || "(env)"}: ${i.message}`)),
      ...ServerEnvParser.crossFieldProblems(cleaned),
    ];
    if (!result.success || problems.length > 0) {
      throw new Error(`Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    }
    return result.data;
  }

  private static crossFieldProblems(env: Record<string, string | undefined>): string[] {
    const problems: string[] = [];
    if (env.VERCEL_ENV !== undefined) {
      for (const key of ["CRON_SECRET", "BLOB_READ_WRITE_TOKEN"]) {
        if (!env[key]) problems.push(`${key}: required on Vercel deployments`);
      }
    }
    const vapid = [env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY, env.VAPID_SUBJECT];
    if (vapid.some(Boolean) && !vapid.every(Boolean)) {
      problems.push("VAPID_*: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT must be set together");
    }
    return problems;
  }
}
