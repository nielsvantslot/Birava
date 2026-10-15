import type { LogFields } from "@/lib/logging/Models";

/**
 * Makes log fields safe to write: secrets are replaced, Errors become plain
 * objects (JSON.stringify would otherwise print `{}`), and depth is capped so
 * a cyclic or huge value can't blow up a log call.
 */
export class LogRedactor {
  private static readonly SECRET_KEY = /pass(word)?|secret|token|authorization|cookie|api[-_]?key|vapid|private/i;
  private static readonly MAX_DEPTH = 4;
  private static readonly REDACTED = "[redacted]";

  static redact(fields: LogFields): LogFields {
    return LogRedactor.walk(fields, 0) as LogFields;
  }

  private static walk(value: unknown, depth: number): unknown {
    if (value instanceof Error) {
      return { name: value.name, message: value.message, stack: value.stack };
    }
    if (value === null || typeof value !== "object") return value;
    if (depth >= LogRedactor.MAX_DEPTH) return "[truncated]";
    if (Array.isArray(value)) return value.map((item) => LogRedactor.walk(item, depth + 1));
    if (value instanceof Date) return value.toISOString();

    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      out[key] = LogRedactor.SECRET_KEY.test(key) ? LogRedactor.REDACTED : LogRedactor.walk(inner, depth + 1);
    }
    return out;
  }
}
