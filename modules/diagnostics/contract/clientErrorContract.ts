import { z } from "zod";

/**
 * `POST /api/debug/client-error`: whatever a crashing browser managed to
 * send. Only `message` is required; every other known field is dropped
 * rather than rejected when it has the wrong type, because the reporter is
 * already mid-crash. Unknown keys are kept and become the report's context.
 */
export const reportClientErrorInput = z.looseObject({
  message: z.string(),
  source: z.string().optional().catch(undefined),
  stack: z.string().optional().catch(undefined),
  pageUrl: z.string().optional().catch(undefined),
  userAgent: z.string().optional().catch(undefined),
});
