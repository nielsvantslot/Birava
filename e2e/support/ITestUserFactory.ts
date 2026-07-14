export type TestUserCredentials = {
  username: string;
  email: string;
  password: string;
};

/** Ensures a fixed E2E account exists, so specs always log in as the same user. */
export interface ITestUserFactory {
  ensure(): Promise<TestUserCredentials>;
}
