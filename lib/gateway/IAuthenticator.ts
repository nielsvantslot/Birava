/** Resolves the signed-in user for the current request, or null. */
export interface IAuthenticator<TUser extends { id: string }> {
  authenticate(): Promise<TUser | null>;
}
