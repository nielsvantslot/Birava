import type { ILogSink } from "@/lib/logging/ILogSink";
import type { LogLevel } from "@/lib/logging/Models";

/** One JSON object per line on stdout/stderr, which Vercel's log drain indexes as fields. */
export class ConsoleLogSink implements ILogSink {
  write(level: LogLevel, line: string): void {
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  }
}
