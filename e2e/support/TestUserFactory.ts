import type { APIRequestContext } from "@playwright/test";
import type { ITestUserFactory, TestUserCredentials } from "./ITestUserFactory";

const FIXED_CREDENTIALS: TestUserCredentials = {
  username: "e2e_test_user",
  email: "e2e-test@birava.test",
  password: "E2eTest123!",
};

/**
 * A second fixed account, distinct from FIXED_CREDENTIALS — for specs that
 * need two real, independent users interacting (e.g. a follow/cheer
 * notification, which the app never creates for your own actions —
 * lib/notify.ts's queueNotifications filters userId === actorId).
 */
export const SECONDARY_CREDENTIALS: TestUserCredentials = {
  username: "e2e_test_user_2",
  email: "e2e-test-2@birava.test",
  password: "E2eTest123!",
};

/**
 * Creates a fixed E2E account through the real `/api/signup` route —
 * exercises signup for free instead of needing a second seeding mechanism.
 * Idempotent: a second run's signup fails because the account already
 * exists, which is treated as success (the account is already ensured).
 * Defaults to the one shared account most specs use; pass SECONDARY_CREDENTIALS
 * for a spec that needs a second, independent user.
 */
export class TestUserFactory implements ITestUserFactory {
  constructor(
    private readonly request: APIRequestContext,
    private readonly baseUrl: string,
    private readonly credentials: TestUserCredentials = FIXED_CREDENTIALS
  ) {}

  async ensure(): Promise<TestUserCredentials> {
    const response = await this.request.post(`${this.baseUrl}/api/signup`, {
      data: this.credentials,
    });

    if (!response.ok()) {
      const body = await response.json().catch(() => ({}) as { error?: unknown });
      const alreadyExists = typeof body.error === "string" && /already|taken|exists/i.test(body.error);
      if (!alreadyExists) {
        throw new Error(`Failed to ensure the E2E test user: ${response.status()} ${JSON.stringify(body)}`);
      }
    }

    return this.credentials;
  }
}
