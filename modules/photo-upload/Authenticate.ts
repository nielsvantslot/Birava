/** Resolves the caller's identity for a request, or null if unauthenticated. Inject your own auth here. */
export type Authenticate<Ctx> = (request: Request, context: Ctx) => Promise<{ id: string } | null>;
