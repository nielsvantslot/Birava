/**
 * Resolves the app's version and writes it to lib/version.json for
 * lib/version.ts to read at runtime.
 *
 * Primary source: the APP_VERSION env var, set directly on the Vercel
 * project by .github/workflows/tag-version.yml right after it creates each
 * git tag — this HAS to be the primary path because Vercel's build sandbox
 * has no .git directory at all (confirmed: `git rev-parse HEAD` fails with
 * "fatal: not a git repository" inside `vercel build`), so a build-time git
 * tag lookup can never work there, deep-clone setting or not.
 *
 * Fallback: read the latest git tag directly — only reachable in local dev,
 * where .git genuinely exists. Final fallback: "0.0.0".
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

function resolveVersion(): string {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;

  try {
    // execFileSync, not execSync — passes argv straight to git with no shell
    // in between, so there's no cmd.exe-vs-/bin/sh quoting mismatch (a plain
    // execSync string is only safe on POSIX; on Windows, cmd.exe doesn't
    // strip single quotes, so 'v*' would be passed to git literally quoted
    // and match nothing), and no risk of the shell itself glob-expanding an
    // unquoted v* against files in this repo (e.g. vercel.json) before git
    // ever sees the argument.
    const latest = execFileSync("git", ["tag", "--list", "v*", "--sort=-v:refname"], {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim()
      .split("\n")[0];
    if (latest) return latest.replace(/^v/, "");
  } catch {
    // No .git available (e.g. Vercel's build sandbox) — fall back below.
  }

  return "0.0.0";
}

const version = resolveVersion();
const outPath = path.join(__dirname, "..", "lib", "version.json");
writeFileSync(outPath, JSON.stringify({ version }, null, 2) + "\n");
console.log(`[write-version] resolved version ${version} -> ${outPath}`);
