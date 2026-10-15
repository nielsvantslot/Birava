import { z } from "zod";

/** `updateProfileUsername`. The format and uniqueness rules live in the command; this only bounds absurd input. */
export const updateUsernameInput = z.object({ username: z.string().max(200) });
