export const NOT_AUTHENTICATED = { error: "Not authenticated" };

export function throwNotAuthenticated(): never {
  throw new Error("Not authenticated");
}
