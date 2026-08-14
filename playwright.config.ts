import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // All specs share one fixed seeded account and one database — running
  // them across parallel workers risks one spec's state interfering with
  // another's (e.g. two specs submitting as the same user at once).
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./e2e/global-setup.ts",
  // next dev compiles each route on first visit — a heavier page like
  // /dashboard alone can take ~15s cold, and a full run hits many distinct
  // routes for the first time. Generous budgets here (rather than scattering
  // per-call timeouts across specs/page objects) absorb that.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:3001",
    trace: "retain-on-failure",
    navigationTimeout: 30_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // WebKit is real Apple WebKit, not an approximation — the only project
    // here that would actually reproduce the history.replaceState() rate
    // limit a regression of e2e/rsc-revalidate-loop.spec.ts's bug depends
    // on. Scoped to that one spec via testMatch rather than running the
    // whole suite twice — every other spec's chromium-only coverage is fine
    // since none of them are WebKit-engine-specific.
    //
    // Briefly widened (2026-08-14) to also cover sw-redirect-cache-poisoning
    // and sw-session-cache-clear, on the theory that Safari's Cache Storage
    // has its own quirks worth a real-engine run — reverted the same day
    // after sw-redirect-cache-poisoning.spec.ts crashed the real WebKit
    // renderer in CI (not a flaky assertion failure — "Navigation failed
    // because page crashed!", reproduced on both the run and its retry).
    // Both specs already have solid Chromium coverage; chasing a genuine
    // WebKit engine crash in a Service-Worker-heavy test is exactly the
    // kind of SW-lifecycle rabbit hole this repo has been burned by before
    // (see the iOS Safari reload-loop incident) and deserves its own
    // focused investigation, not a fix improvised mid-unrelated-PR.
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      testMatch: /rsc-revalidate-loop\.spec\.ts/,
    },
  ],
  webServer: {
    // Deliberately `next dev`, not `next build && next start`: `next start`
    // hardcodes NODE_ENV=production, which flips
    // StorageAdapterFactory (lib/storageAdapterFactory.ts) over to the Vercel
    // Blob upload path — unusable here without real Blob credentials, and
    // every photo upload would fail permanently (not transiently), leaving
    // queued check-ins stuck forever. `next dev` matches how local
    // development actually runs (local-disk storage), which is what this
    // environment can actually satisfy. Slower on-demand compilation on
    // first load is the trade-off — the generous timeout below absorbs it.
    command: "npm run dev -- --port 3001",
    url: "http://localhost:3001/login",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
