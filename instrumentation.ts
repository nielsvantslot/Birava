/**
 * Runs once when the server starts. Validating the environment here makes a
 * missing or malformed variable fail the boot with one readable message
 * instead of the first request that needs it (see lib/env/ServerEnvParser.ts).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { Env } = await import("@/lib/env/Env");
    void Env.server;
  }
}
