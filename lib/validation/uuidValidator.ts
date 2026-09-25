const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class UuidValidator {
  /** Guards a caller-supplied id before it reaches Prisma, which throws on a malformed value instead of just returning no rows. */
  static isValid(id: string): boolean {
    return UUID_PATTERN.test(id);
  }
}
