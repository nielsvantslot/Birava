import { z, type ZodType } from "zod";

/** Building blocks the per-module input contracts share, so a rule (what an id looks like, how absent values are read) is written once. */
export class ContractFields {
  /** A Postgres uuid column's text form (any version/variant, so seeded and generated ids both pass). */
  static readonly id = z.guid();

  /**
   * An optional field that means "none": absent, undefined and null all read
   * as null. A queued client payload that omits a field must not be rejected.
   */
  static nullable<T extends ZodType>(schema: T) {
    return schema.nullish().transform((value) => value ?? null);
  }
}
