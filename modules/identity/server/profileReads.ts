import { getProfileByUsername as getProfileByUsernameQuery } from "@/modules/identity/server/userQueries";
import type { GetProfileByUsernameDTO, ProfileDTO } from "@/lib/dtos";

// A read for pages. Deliberately not a Server Action: every export of a
// "use server" file is a public POST endpoint, and a read has no business
// being one.
export async function getProfileByUsername(input: GetProfileByUsernameDTO): Promise<ProfileDTO | null> {
  return getProfileByUsernameQuery(input.username);
}
