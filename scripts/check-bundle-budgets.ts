/**
 * The JavaScript size gate (npm run budgets:check), run in CI after `next build`.
 * For every app route it adds up the gzipped size of the JS files the route
 * loads (layouts and shared chunks included, which is what a visitor downloads
 * on first load) and fails if one is over its budget in perf-budgets.json.
 * A route with no entry of its own is held to `defaultKb`, so a new page can't
 * quietly ship a heavy bundle.
 *
 *   tsx scripts/check-bundle-budgets.ts            check against the budgets
 *   tsx scripts/check-bundle-budgets.ts --suggest  print budgets for the current build (current size plus 10%, rounded up to 5 kB)
 *
 * Raising a budget is a reviewed change to perf-budgets.json, in the same PR
 * as whatever made the route heavier. Baseline: docs/audit/birava-perf-audit-2026-07-10.md.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

type Budgets = { defaultKb: number; routes: Record<string, number> };

const BUILD_DIR = join(process.cwd(), ".next");

function measureRoutes(): Record<string, number> {
  const manifest = JSON.parse(readFileSync(join(BUILD_DIR, "app-build-manifest.json"), "utf8")) as { pages: Record<string, string[]> };
  const gzipped = new Map<string, number>();
  const sizeOf = (file: string): number => {
    let size = gzipped.get(file);
    if (size === undefined) {
      size = gzipSync(readFileSync(join(BUILD_DIR, file))).length;
      gzipped.set(file, size);
    }
    return size;
  };

  const routes: Record<string, number> = {};
  for (const [route, files] of Object.entries(manifest.pages)) {
    if (!route.endsWith("/page")) continue; // route handlers ship no client JS
    const js = [...new Set(files.filter((f) => f.endsWith(".js")))];
    routes[route] = Math.round((js.reduce((total, file) => total + sizeOf(file), 0) / 1024) * 10) / 10;
  }
  return routes;
}

function main(): void {
  let measured: Record<string, number>;
  try {
    measured = measureRoutes();
  } catch {
    console.error("No build found in .next. Run `next build` first.");
    process.exit(2);
  }

  if (process.argv.includes("--suggest")) {
    const routes = Object.fromEntries(Object.entries(measured).map(([route, kb]) => [route, Math.ceil((kb * 1.1) / 5) * 5]));
    console.log(JSON.stringify({ defaultKb: 150, routes }, null, 2));
    return;
  }

  const budgets = JSON.parse(readFileSync(join(process.cwd(), "perf-budgets.json"), "utf8")) as Budgets;
  const over: string[] = [];
  for (const [route, kb] of Object.entries(measured).sort(([a], [b]) => a.localeCompare(b))) {
    const budget = budgets.routes[route] ?? budgets.defaultKb;
    const flag = kb > budget ? "OVER" : "ok  ";
    console.log(`${flag} ${route.padEnd(48)} ${kb.toFixed(1).padStart(7)} kB gz  (budget ${budget} kB)`);
    if (kb > budget) over.push(`${route}: ${kb} kB > ${budget} kB`);
  }

  if (over.length > 0) {
    console.error(`\n${over.length} route(s) over their JavaScript budget:\n  ${over.join("\n  ")}`);
    console.error("Trim the bundle, or raise the budget in perf-budgets.json with a reason.");
    process.exit(1);
  }
  console.log("\nAll routes are within their JavaScript budgets.");
}

main();
