import type { ZodType } from "zod";
import { ApiError, type FieldErrors } from "./ApiError";

export class InputParser {
  /** Parses `value` or throws a VALIDATION_FAILED ApiError carrying field-level messages. */
  static parse<S extends ZodType>(schema: S, value: unknown, what = "Invalid request."): ReturnType<S["parse"]> {
    const result = schema.safeParse(value);
    if (result.success) return result.data as ReturnType<S["parse"]>;

    throw ApiError.validation(what, InputParser.fields(result.error.issues));
  }

  /** Groups zod issues by field path, for an error response. */
  static fields(issues: readonly { path: readonly PropertyKey[]; message: string }[]): FieldErrors {
    const fields: FieldErrors = {};
    for (const issue of issues) {
      const path = issue.path.map(String).join(".") || "_";
      (fields[path] ??= []).push(issue.message);
    }
    return fields;
  }
}
