import type { ILogger } from "@/lib/logging/ILogger";
import type { ILogSink } from "@/lib/logging/ILogSink";
import type { LogFields, LogLevel, LogRecord } from "@/lib/logging/Models";
import { LogRedactor } from "@/lib/logging/LogRedactor";
import { RequestContext } from "@/lib/logging/RequestContext";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export class JsonLogger implements ILogger {
  constructor(
    private readonly module: string,
    private readonly sink: ILogSink,
    private readonly minLevel: LogLevel,
    private readonly baseFields: LogFields = {},
    private readonly resolveRequestId: () => Promise<string | undefined> = RequestContext.requestId
  ) {}

  debug(message: string, fields?: LogFields): void {
    this.log("debug", message, fields);
  }

  info(message: string, fields?: LogFields): void {
    this.log("info", message, fields);
  }

  warn(message: string, fields?: LogFields): void {
    this.log("warn", message, fields);
  }

  error(message: string, fields?: LogFields): void {
    this.log("error", message, fields);
  }

  child(fields: LogFields): ILogger {
    return new JsonLogger(
      this.module,
      this.sink,
      this.minLevel,
      { ...this.baseFields, ...fields },
      this.resolveRequestId
    );
  }

  private log(level: LogLevel, message: string, fields?: LogFields): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;
    // Logging never awaits the caller: the request id lookup is async only
    // because headers() is, and a failed or slow lookup must not delay or
    // break the code being logged.
    void this.resolveRequestId()
      .catch(() => undefined)
      .then((requestId) => {
        const record: LogRecord = {
          level,
          time: new Date().toISOString(),
          module: this.module,
          msg: message,
          ...(requestId ? { requestId } : {}),
          ...(LogRedactor.redact({ ...this.baseFields, ...fields }) as LogFields),
        };
        this.sink.write(level, JSON.stringify(record));
      });
  }
}
