import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The gate for ADR 0002: nothing the outside world can call exists outside the
 * gateway. Every Route Handler export and every Server Action export in the
 * app must be built with `gateway.route.*` / `gateway.action.*`, so auth,
 * limits, validation and the error envelope can't be skipped by forgetting a
 * wrapper. Adding an unwrapped endpoint fails this test.
 */

const ROOT = process.cwd();
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
/** Next route-segment config exports that are not handlers. */
const ROUTE_CONFIG_EXPORTS = ["runtime", "dynamic", "dynamicParams", "revalidate", "fetchCache", "maxDuration", "preferredRegion"];

function walk(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, found);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) found.push(full);
  }
  return found;
}

const rel = (file: string) => relative(ROOT, file).split("\\").join("/");

/** Every top-level `export ...` statement of a file, as written (first line only). */
function exportLines(source: string): string[] {
  return source.split("\n").filter((line) => /^export\s/.test(line));
}

const routeFiles = walk(join(ROOT, "app", "api")).filter((f) => /[\\/]route\.tsx?$/.test(f));
const sourceFiles = [...walk(join(ROOT, "app")), ...walk(join(ROOT, "modules")), ...walk(join(ROOT, "lib")), ...walk(join(ROOT, "components"))];
const serverActionFiles = sourceFiles.filter((f) => /^\s*["']use server["']/.test(readFileSync(f, "utf8").split("\n").find((l) => l.trim() !== "" && !l.trim().startsWith("//")) ?? ""));

describe("gateway coverage", () => {
  it("finds the route handlers and server actions it is meant to check", () => {
    expect(routeFiles.length).toBeGreaterThan(15);
    expect(serverActionFiles.length).toBeGreaterThan(5);
  });

  describe("route handlers", () => {
    for (const file of routeFiles) {
      it(`${rel(file)} exports only gateway-built handlers`, () => {
        const offenders: string[] = [];
        for (const line of exportLines(readFileSync(file, "utf8"))) {
          const name = /^export\s+(?:async\s+)?(?:function|const|let|var)\s+(\w+)/.exec(line)?.[1];
          if (!name) {
            offenders.push(line);
            continue;
          }
          if (ROUTE_CONFIG_EXPORTS.includes(name)) continue;
          const built = /^export\s+const\s+\w+\s*=\s*gateway\.route\.(authed|public|cron)\(/.test(line);
          if (!built || !HTTP_METHODS.includes(name)) offenders.push(line);
        }
        expect(offenders, "every exported handler must be `export const <METHOD> = gateway.route.authed|public|cron(...)`").toEqual([]);
      });
    }
  });

  describe("server actions", () => {
    for (const file of serverActionFiles) {
      it(`${rel(file)} exports only gateway-built actions`, () => {
        const offenders: string[] = [];
        for (const line of exportLines(readFileSync(file, "utf8"))) {
          if (/^export\s+(type|interface)\s/.test(line)) continue;
          if (/^export\s+const\s+\w+\s*=\s*gateway\.action\.(authed|public)\(/.test(line)) continue;
          offenders.push(line);
        }
        expect(offenders, "every export of a \"use server\" file must be `export const <name> = gateway.action.authed|public(...)`").toEqual([]);
      });
    }
  });

  it("keeps reads out of server actions", () => {
    // A read-only action is a public POST endpoint. Reads live in modules/*/server/*Reads.ts, called by pages
    // and by GET routes. Action files are for mutations, so a read-shaped name in one is a mistake.
    const readShaped = /^export\s+const\s+((?:get|search|is|has|list|find|fetch)[A-Z]\w*)/;
    const offenders: string[] = [];
    for (const file of serverActionFiles) {
      expect(rel(file), "server actions live in modules/*/actions").toMatch(/^modules\/[^/]+\/actions\//);
      for (const line of exportLines(readFileSync(file, "utf8"))) {
        const name = readShaped.exec(line)?.[1];
        if (name) offenders.push(rel(file) + ": " + name);
      }
    }
    expect(offenders).toEqual([]);
  });
});
