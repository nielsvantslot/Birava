import { describe, expect, it } from "vitest";
import { LogRedactor } from "@/lib/logging/LogRedactor";

describe("LogRedactor", () => {
  it("redacts secret-looking keys at any depth", () => {
    const out = LogRedactor.redact({
      user: "u1",
      password: "hunter2",
      headers: { Authorization: "Bearer x", cookie: "a=b", accept: "json" },
      list: [{ sessionToken: "t" }],
    });
    expect(out).toEqual({
      user: "u1",
      password: "[redacted]",
      headers: { Authorization: "[redacted]", cookie: "[redacted]", accept: "json" },
      list: [{ sessionToken: "[redacted]" }],
    });
  });

  it("turns Errors into plain objects with message and stack", () => {
    const out = LogRedactor.redact({ error: new Error("boom") }) as { error: { name: string; message: string; stack?: string } };
    expect(out.error.name).toBe("Error");
    expect(out.error.message).toBe("boom");
    expect(out.error.stack).toContain("boom");
  });

  it("caps depth so a cyclic value cannot recurse forever", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(JSON.stringify(LogRedactor.redact({ cyclic }))).toContain("[truncated]");
  });

  it("serialises dates", () => {
    expect(LogRedactor.redact({ at: new Date("2026-01-01T00:00:00.000Z") })).toEqual({ at: "2026-01-01T00:00:00.000Z" });
  });
});
