import { z } from "zod";

/** `POST /api/auth/login`. Emptiness is checked by the route so it can answer with one friendly message. */
export const loginInput = z.object({
  email: z.string(),
  password: z.string(),
});

/** `POST /api/signup`. The rules for a valid username, email and password live in `createUser`. */
export const signupInput = z.object({
  username: z.string(),
  email: z.string(),
  password: z.string(),
});
