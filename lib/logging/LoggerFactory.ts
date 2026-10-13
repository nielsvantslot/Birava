import type { ILogger } from "@/lib/logging/ILogger";
import type { LogLevel } from "@/lib/logging/Models";
import { ConsoleLogSink } from "@/lib/logging/ConsoleLogSink";
import { JsonLogger } from "@/lib/logging/JsonLogger";

/** Composition root for loggers: `LoggerFactory.create("push")` at the top of a module. */
export class LoggerFactory {
  static create(module: string, minLevel: LogLevel = "info"): ILogger {
    return new JsonLogger(module, new ConsoleLogSink(), minLevel);
  }
}
