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
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Deliberately `next dev`, not `next build && next start`: `next start`
    // hardcodes NODE_ENV=production, which flips
    // DrinkPhotoStorageFactory (lib/photoUpload.ts) over to the Vercel Blob
    // upload path — unusable here without real Blob credentials, and every
    // photo upload would fail permanently (not transiently), leaving queued
    // check-ins stuck forever. `next dev` matches how local development
    // actually runs (local-disk storage), which is what this environment
    // can actually satisfy. Slower on-demand compilation on first load is
    // the trade-off — the generous timeout below absorbs it.
    command: "npm run dev -- --port 3001",
    url: "http://localhost:3001/login",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
