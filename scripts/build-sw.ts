/**
 * Bundles the service worker (sw/sw.ts) to public/sw.js (npm run sw:build).
 * With --check it builds in memory and fails if the committed public/sw.js is
 * not what the source produces (run in CI), so the two can never drift and
 * deploys do not depend on a build step having run.
 *
 * The built file is committed on purpose: the browser decides whether a new
 * worker is available by comparing this file's bytes, so what ships must be
 * exactly what was reviewed.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";

const OUTFILE = join(process.cwd(), "public", "sw.js");

const BANNER = "// GENERATED from sw/ by `npm run sw:build`. Edit sw/sw.ts, not this file.\n";

async function bundle(): Promise<string> {
  const result = await build({
    entryPoints: [join(process.cwd(), "sw", "sw.ts")],
    bundle: true,
    format: "iife",
    target: "es2020",
    platform: "browser",
    minify: false,
    legalComments: "none",
    banner: { js: BANNER },
    write: false,
    outfile: OUTFILE,
    logLevel: "warning",
  });
  const output = result.outputFiles[0];
  if (!output) throw new Error("esbuild produced no output");
  return output.text;
}

async function main(): Promise<void> {
  const built = await bundle();

  if (process.argv.includes("--check")) {
    let committed = "";
    try {
      committed = readFileSync(OUTFILE, "utf8");
    } catch {
      // Missing counts as out of date.
    }
    if (committed.replace(/\r\n/g, "\n") !== built) {
      console.error("public/sw.js is out of date with sw/. Run `npm run sw:build` and commit the result.");
      process.exit(1);
    }
    console.log("public/sw.js is up to date.");
    return;
  }

  writeFileSync(OUTFILE, built);
  console.log(`Wrote ${OUTFILE} (${built.length} bytes)`);
}

void main();
