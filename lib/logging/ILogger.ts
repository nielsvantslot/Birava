import type { LogFields } from "@/lib/logging/Models";

export interface ILogger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  /** Pass the caught value as `error` in fields to log its message and stack. */
  error(message: string, fields?: LogFields): void;
  /** A logger that adds `fields` (for example `{ userId }`) to every line it writes. */
  child(fields: LogFields): ILogger;
}
