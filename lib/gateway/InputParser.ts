import type { ZodType } from "zod";
import { ApiError, type FieldErrors } from "./ApiError";

export class InputParser {
  /** Parses `value` or throws a VALIDATION_FAILED ApiError carrying field-level messages. */
  static parse<S extends ZodType>(schema: S, value: unknown, what = "Invalid request."): ReturnType<S["parse"]> {
    const result = schema.safeParse(value);
    if (result.success) return result.data as ReturnType<S["parse"]>;

    const fields: FieldErrors = {};
    for (const issue of result.error.issues) {
      const path = issue.path.map(String).join(".") || "_";
      (fields[path] ??= []).push(issue.message);
    }
    throw ApiError.validation(what, fields);
  }
}
