import { z } from "zod";

/** `GET /api/people/search?q=`: find people by username. */
export const searchPeopleQuery = z.object({ q: z.string().max(100) });
