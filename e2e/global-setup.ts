import type { FullConfig } from "@playwright/test";
import { chromium, request } from "@playwright/test";
import { LoginPage } from "./pages/LoginPage";
import { TestUserFactory } from "./support/TestUserFactory";

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
  } finally {
    await browser.close();
  }
}
