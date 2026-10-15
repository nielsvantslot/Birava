/** Validated, typed server-side configuration. See lib/env/ServerEnvParser.ts. */
export interface ServerEnvValues {
  NODE_ENV: "development" | "production" | "test";
  DATABASE_URL: string;
  /** Set by Vercel on every deployment; absent locally and in CI. */
  VERCEL_ENV?: "production" | "preview" | "development";
  /** Bearer secret guarding /api/cron/*. Required on Vercel, optional elsewhere. */
  CRON_SECRET?: string;
  /** Vercel Blob token. Required on Vercel, optional elsewhere (local disk storage). */
  BLOB_READ_WRITE_TOKEN?: string;
  /** Web push. All three are set together, or none (push is then disabled). */
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}
