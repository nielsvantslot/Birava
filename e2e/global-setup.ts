import path from "path";
import type { FullConfig } from "@playwright/test";
import { chromium, request } from "@playwright/test";
import { LoginPage } from "./pages/LoginPage";
import { LogDrinkPage } from "./pages/LogDrinkPage";
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

    // Visiting /log only compiles the page's client bundle — the photo
    // upload API route (app/api/uploads/drink-photo/route.ts) is a separate
    // compilation unit that Turbopack only touches on its first real POST.
    // Without paying that cost here, whichever spec first attaches a photo
    // races its request body against that route's first compile, which can
    // fail outright ("Failed to parse body as FormData") rather than just
    // being slow — this warmup upload absorbs it instead.
    const logPage = new LogDrinkPage(page);
    await logPage.goto();
    await logPage.fillDrinkName(`E2E Warmup ${Date.now()}`);
    await logPage.attachPhoto(TEST_PHOTO);
    await logPage.submit();
    await page.locator(".toast.show").waitFor({ state: "visible" });
    await logPage.pendingPanel().waitFor({ state: "hidden", timeout: WARMUP_TIMEOUT_MS });
  } finally {
    await browser.close();
  }
}
