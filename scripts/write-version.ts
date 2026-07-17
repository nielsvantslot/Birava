/**
 * Resolves the app's version from the latest git tag (maintained by
 * .github/workflows/tag-version.yml) and writes it to lib/version.json for
 * lib/version.ts to read at runtime. Runs at Vercel build time (vercel.json)
 * so the deployed build always reflects the tag pushed for that deploy.
 *
 * Best-effort: falls back to "0.0.0" if no tags are reachable (local dev
 * without a fetched tag history, or before the first tag exists).
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

function resolveVersion(): string {
  try {
    execSync("git fetch --tags origin", { stdio: "ignore" });
  } catch {
    // Best-effort — fall through to whatever tags are already local.
  }

  try {
    const latest = execSync("git tag --list 'v*' --sort=-v:refname")
      .toString()
      .trim()
      .split("\n")[0];
    if (latest) return latest.replace(/^v/, "");
  } catch {
    // No git history available at all — fall back below.
  }

  return "0.0.0";
}

const version = resolveVersion();
const outPath = path.join(__dirname, "..", "lib", "version.json");
writeFileSync(outPath, JSON.stringify({ version }, null, 2) + "\n");
console.log(`[write-version] resolved version ${version} -> ${outPath}`);
