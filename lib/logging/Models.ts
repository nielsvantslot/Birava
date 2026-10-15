export type LogLevel = "debug" | "info" | "warn" | "error";

/** Structured context attached to a log line. Values are redacted before output. */
export type LogFields = Record<string, unknown>;

/** The JSON object written for each log line. */
export interface LogRecord extends LogFields {
  level: LogLevel;
  time: string;
  module: string;
  msg: string;
  requestId?: string;
}
