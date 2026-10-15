import { describe, expect, it } from "vitest";
import { ServerEnvParser } from "@/lib/env/ServerEnvParser";

const base = { DATABASE_URL: "postgresql://u:p@localhost:5432/db" };
const vercel = { ...base, VERCEL_ENV: "production", CRON_SECRET: "s", BLOB_READ_WRITE_TOKEN: "t" };

describe("ServerEnvParser", () => {
  it("accepts a minimal local environment and defaults NODE_ENV", () => {
    const env = ServerEnvParser.parse(base);
    expect(env.NODE_ENV).toBe("development");
    expect(env.VERCEL_ENV).toBeUndefined();
  });

  it("rejects a missing DATABASE_URL", () => {
    expect(() => ServerEnvParser.parse({})).toThrow(/DATABASE_URL/);
  });

  it("rejects a DATABASE_URL that is not a postgres URL", () => {
    expect(() => ServerEnvParser.parse({ DATABASE_URL: "mysql://x" })).toThrow(/postgres/);
  });

  it("requires the cron secret and blob token on Vercel deployments only", () => {
    expect(() => ServerEnvParser.parse({ ...base, VERCEL_ENV: "preview" })).toThrow(/CRON_SECRET[\s\S]*BLOB_READ_WRITE_TOKEN/);
    expect(ServerEnvParser.parse(vercel).CRON_SECRET).toBe("s");
  });

  it("treats empty strings as unset", () => {
    const env = ServerEnvParser.parse({ ...base, VAPID_PUBLIC_KEY: "", VAPID_PRIVATE_KEY: "", VAPID_SUBJECT: "" });
    expect(env.VAPID_PUBLIC_KEY).toBeUndefined();
  });

  it("requires the three VAPID values together", () => {
    expect(() => ServerEnvParser.parse({ ...base, VAPID_PUBLIC_KEY: "k" })).toThrow(/must be set together/);
    const all = { ...base, VAPID_PUBLIC_KEY: "a", VAPID_PRIVATE_KEY: "b", VAPID_SUBJECT: "mailto:x@y.z" };
    expect(ServerEnvParser.parse(all).VAPID_SUBJECT).toBe("mailto:x@y.z");
  });

  it("rejects a VAPID subject that is not mailto: or https://", () => {
    const bad = { ...base, VAPID_PUBLIC_KEY: "a", VAPID_PRIVATE_KEY: "b", VAPID_SUBJECT: "x@y.z" };
    expect(() => ServerEnvParser.parse(bad)).toThrow(/mailto/);
  });

  it("reports every problem in one error", () => {
    expect(() => ServerEnvParser.parse({ VERCEL_ENV: "preview" })).toThrow(/DATABASE_URL[\s\S]*CRON_SECRET/);
  });
});
