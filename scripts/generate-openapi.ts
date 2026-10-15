/**
 * Generates the /api/v1 OpenAPI document from the route definitions
 * (npm run openapi:generate) and, with --check, fails if the committed copy
 * (docs/api/openapi.v1.json) is out of date (run in CI). The same document is
 * served live at /api/v1/openapi.json on dev and staging (not production, where
 * the committed copy is the reference).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { V1AppFactory } from "../app/api/v1/_hono/V1AppFactory";

const FILE = join(process.cwd(), "docs", "api", "openapi.v1.json");

// Building the app registers routes only; nothing here touches the database.
const never = async (): Promise<never> => {
  throw new Error("not available while generating the document");
};
const { app } = V1AppFactory.create({
  authenticate: never,
  rateLimiter: { consume: never },
  idempotency: { begin: never, complete: never, abandon: never },
  logger: { debug() {}, info() {}, warn() {}, error() {}, child() { return this; } },
  clientIp: () => "0.0.0.0",
  exposeDocument: true,
});

const generated = `${JSON.stringify(V1AppFactory.document(app), null, 2)}\n`;

if (process.argv.includes("--check")) {
  let committed = "";
  try {
    committed = readFileSync(FILE, "utf8");
  } catch {
    // Missing counts as out of date.
  }
  if (committed.replace(/\r\n/g, "\n") !== generated) {
    console.error("docs/api/openapi.v1.json is out of date. Run `npm run openapi:generate` and commit the result.");
    process.exit(1);
  }
  console.log("docs/api/openapi.v1.json is up to date.");
} else {
  writeFileSync(FILE, generated);
  console.log(`Wrote ${FILE}`);
}
