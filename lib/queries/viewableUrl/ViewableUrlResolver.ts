import { db } from "@/lib/db";
import { UuidValidator } from "@/lib/validation/uuidValidator";

/**
 * Resolves a caller-supplied id to a stored URL for serving, guarding the id
 * format first (Prisma throws on a malformed one instead of just returning
 * no rows). Deliberately does no per-viewer visibility gating itself — both
 * of this class's current uses (check-in photos, avatars) are shown to any
 * authenticated viewer app-wide, with the real requireUser()/ownership
 * checks living in the API route that calls resolve(), not here — so
 * there's nothing to route between the two lookups below beyond which
 * single column they read.
 */
export class ViewableUrlResolver {
  private constructor(private readonly fetchUrl: (id: string) => Promise<string | null>) {}

  static forDrinkPhoto(): ViewableUrlResolver {
    return new ViewableUrlResolver(async (entryId) => {
      const entry = await db.drinkEntry.findUnique({ where: { id: entryId }, select: { photoUrl: true } });
      return entry?.photoUrl ?? null;
    });
  }

  static forAvatar(): ViewableUrlResolver {
    return new ViewableUrlResolver(async (userId) => {
      const user = await db.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
      return user?.avatarUrl ?? null;
    });
  }

  async resolve(id: string): Promise<string | null> {
    if (!UuidValidator.isValid(id)) return null;
    return this.fetchUrl(id);
  }
}
