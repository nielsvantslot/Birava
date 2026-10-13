import type { LogLevel } from "@/lib/logging/Models";

/** Where a finished log line goes. Injected so tests can capture output. */
export interface ILogSink {
  write(level: LogLevel, line: string): void;
}
