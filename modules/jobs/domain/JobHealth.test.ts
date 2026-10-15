import { describe, expect, it } from "vitest";
import { DAY_MS, MINUTE_MS } from "./JobDefinition";
import { JobHealth, type JobRunSnapshot } from "./JobHealth";

const reminders = { name: "session-reminders" as const, expectedEveryMs: 15 * MINUTE_MS };
const daily = { name: "purge-deleted-accounts" as const, expectedEveryMs: DAY_MS };
const NOW = new Date("2026-10-15T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

const snapshot = (lastSuccessAt: Date | null, failure: JobRunSnapshot["lastFailure"] = null): JobRunSnapshot => ({
  job: "session-reminders",
  lastSuccessAt,
  lastFailure: failure,
});

describe("JobHealth.evaluate", () => {
  it("is healthy when the last success is within three intervals", () => {
    const status = JobHealth.evaluate(reminders, snapshot(ago(40 * MINUTE_MS)), NOW, ago(DAY_MS));

    expect(status).toMatchObject({ ok: true, reason: "ok", lastSuccessAgeMinutes: 40 });
  });

  it("is stale once the last success is older than three intervals, and carries the last error", () => {
    const status = JobHealth.evaluate(reminders, snapshot(ago(50 * MINUTE_MS), { at: ago(MINUTE_MS), error: "db down" }), NOW, ago(DAY_MS));

    expect(status).toMatchObject({ ok: false, reason: "stale", lastError: "db down" });
  });

  it("scales the allowance to the job: a daily job may be up to three days quiet", () => {
    expect(JobHealth.evaluate(daily, snapshot(ago(2.9 * DAY_MS)), NOW, ago(10 * DAY_MS)).ok).toBe(true);
    expect(JobHealth.evaluate(daily, snapshot(ago(3.1 * DAY_MS)), NOW, ago(10 * DAY_MS)).ok).toBe(false);
  });

  it("gives a job that has never succeeded the same allowance from when tracking began, so a fresh deploy is not an outage", () => {
    expect(JobHealth.evaluate(daily, undefined, NOW, ago(DAY_MS))).toMatchObject({ ok: true, reason: "not-yet-run" });
    expect(JobHealth.evaluate(daily, undefined, NOW, null)).toMatchObject({ ok: true, reason: "not-yet-run" });
  });

  it("flags a job that never succeeded once tracking has run for longer than its allowance", () => {
    expect(JobHealth.evaluate(daily, undefined, NOW, ago(4 * DAY_MS))).toMatchObject({ ok: false, reason: "never-ran" });
    expect(JobHealth.evaluate(reminders, snapshot(null, { at: ago(MINUTE_MS), error: "boom" }), NOW, ago(DAY_MS))).toMatchObject({
      ok: false,
      reason: "never-ran",
      lastError: "boom",
    });
  });
});
