import { describe, expect, it } from "vitest";
import { JsonLogger } from "@/lib/logging/JsonLogger";
import type { ILogSink } from "@/lib/logging/ILogSink";
import type { LogLevel } from "@/lib/logging/Models";

class CapturingSink implements ILogSink {
  lines: { level: LogLevel; record: Record<string, unknown> }[] = [];
  write(level: LogLevel, line: string): void {
    this.lines.push({ level, record: JSON.parse(line) });
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("JsonLogger", () => {
  it("writes one JSON record with level, module, message, time and request id", async () => {
    const sink = new CapturingSink();
    const logger = new JsonLogger("push", sink, "info", {}, async () => "req-123");
    logger.info("sent", { count: 2 });
    await flush();
    expect(sink.lines).toHaveLength(1);
    expect(sink.lines[0]!.level).toBe("info");
    expect(sink.lines[0]!.record).toMatchObject({ level: "info", module: "push", msg: "sent", count: 2, requestId: "req-123" });
    expect(typeof sink.lines[0]!.record.time).toBe("string");
  });

  it("omits requestId outside a request", async () => {
    const sink = new CapturingSink();
    new JsonLogger("m", sink, "info", {}, async () => undefined).info("x");
    await flush();
    expect(sink.lines[0]!.record).not.toHaveProperty("requestId");
  });

  it("drops lines below the minimum level", async () => {
    const sink = new CapturingSink();
    const logger = new JsonLogger("m", sink, "warn", {}, async () => undefined);
    logger.debug("a");
    logger.info("b");
    logger.warn("c");
    logger.error("d");
    await flush();
    expect(sink.lines.map((l) => l.record.msg)).toEqual(["c", "d"]);
  });

  it("child loggers add fields to every line", async () => {
    const sink = new CapturingSink();
    const logger = new JsonLogger("m", sink, "info", {}, async () => undefined).child({ userId: "u1" });
    logger.info("hello", { extra: true });
    await flush();
    expect(sink.lines[0]!.record).toMatchObject({ userId: "u1", extra: true });
  });

  it("redacts secrets and serialises errors in the output", async () => {
    const sink = new CapturingSink();
    new JsonLogger("m", sink, "info", {}, async () => undefined).error("failed", { token: "abc", error: new Error("nope") });
    await flush();
    const record = sink.lines[0]!.record as { token: string; error: { message: string } };
    expect(record.token).toBe("[redacted]");
    expect(record.error.message).toBe("nope");
  });

  it("never throws if the request id lookup fails", async () => {
    const sink = new CapturingSink();
    const logger = new JsonLogger("m", sink, "info", {}, async () => {
      throw new Error("no request scope");
    });
    expect(() => logger.info("still logs")).not.toThrow();
    await flush();
    expect(sink.lines).toHaveLength(1);
  });
});
