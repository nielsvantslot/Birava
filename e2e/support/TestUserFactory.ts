import type { APIRequestContext } from "@playwright/test";
import type { ITestUserFactory, TestUserCredentials } from "./ITestUserFactory";

const FIXED_CREDENTIALS: TestUserCredentials = {
  username: "e2e_test_user",
  email: "e2e-test@birava.test",
  password: "E2eTest123!",
};

/**
 * Creates the one fixed E2E account through the real `/api/signup` route —
 * exercises signup for free instead of needing a second seeding mechanism.
 * Idempotent: a second run's signup fails because the account already
 * exists, which is treated as success (the account is already ensured).
 */
export class TestUserFactory implements ITestUserFactory {
  constructor(
    private readonly request: APIRequestContext,
    private readonly baseUrl: string
  ) {}

  async ensure(): Promise<TestUserCredentials> {
    const response = await this.request.post(`${this.baseUrl}/api/signup`, {
      data: FIXED_CREDENTIALS,
    });

    if (!response.ok()) {
      const body = await response.json().catch(() => ({}) as { error?: unknown });
      const alreadyExists = typeof body.error === "string" && /already|taken|exists/i.test(body.error);
      if (!alreadyExists) {
        throw new Error(`Failed to ensure the E2E test user: ${response.status()} ${JSON.stringify(body)}`);
      }
    }

    return FIXED_CREDENTIALS;
  }
}
