/** The /login screen. */
export interface ILoginPage {
  goto(): Promise<void>;
  login(email: string, password: string): Promise<void>;
}
