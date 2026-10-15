/** Next implements redirect() and notFound() by throwing; those are not failures and must reach Next untouched. */
export class ControlFlow {
  static isNextControlFlow(error: unknown): boolean {
    if (typeof error !== "object" || error === null || !("digest" in error)) return false;
    return typeof error.digest === "string" && error.digest.startsWith("NEXT_");
  }
}
