import fs from "fs";
import path from "path";
import type { FullConfig } from "@playwright/test";
import { chromium, request } from "@playwright/test";
import { LoginPage } from "./pages/LoginPage";
import { TestUserFactory } from "./support/TestUserFactory";

const TEST_PHOTO = path.join(__dirname, "fixtures", "test-photo.jpg");

// next dev compiles each route on first visit — left to individual specs,
// that cold-compile cost lands unpredictably (whichever test happens to
// hit a route first eats it, sometimes past that test's own timeout).
// Paying it once here, up front, in a real browser (so auth/middleware/
// rendering all execute exactly like a real spec would, unlike a plain
// HTTP warmup which can get redirected by middleware before ever reaching
// a protected page's own compile), means every spec afterward hits an
// already-compiled route.
const WARMUP_TIMEOUT_MS = 90_000;

/** Ensures the fixed E2E account exists and pre-compiles the routes specs use, before any spec runs. */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:3001";
  const requestContext = await request.newContext();
  let credentials;
  try {
    credentials = await new TestUserFactory(requestContext, baseURL).ensure();
  } finally {
    await requestContext.dispose();
  }

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ baseURL });
    page.setDefaultTimeout(WARMUP_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(WARMUP_TIMEOUT_MS);

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(credentials.email, credentials.password);
    await page.goto("/log", { waitUntil: "networkidle" });

    // The photo upload route (app/api/uploads/drink-photo/route.ts) is a
    // separate compilation unit from /log's client bundle — Turbopack only
    // touches it on its first real POST. That first compile is slow enough
    // that whichever spec's real photo submission happened to hit it first
    // could lose a race against its own request body ("Failed to parse body
    // as FormData") or have the connection reset outright.
    //
    // A previous attempt drove this through the full client-side upload
    // pipeline (log-drink-form.tsx's compression/HEIC-conversion/
    // AbortController machinery) via a real page interaction, and that
    // *itself* raced the same cold compile and aborted — the browser-side
    // pipeline adds its own latency and abort surface on top of the
    // server's compile time. Posting the multipart body directly via the
    // request API instead: no client JS runs, and the timeout is ours to
    // set generously, so it can only be slow, never lose an ambient race.
    const uploadResponse = await page.context().request.post(`${baseURL}/api/uploads/drink-photo`, {
      multipart: {
        file: {
          name: "test-photo.jpg",
          mimeType: "image/jpeg",
          buffer: fs.readFileSync(TEST_PHOTO),
        },
      },
      timeout: WARMUP_TIMEOUT_MS,
    });
    if (!uploadResponse.ok()) {
      throw new Error(
        `Photo upload route warmup failed: ${uploadResponse.status()} ${await uploadResponse.text()}`
      );
    }
  } finally {
    await browser.close();
  }
}
