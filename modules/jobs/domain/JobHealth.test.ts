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

  it("is stale once the last success is older than three intervals", () => {
    const status = JobHealth.evaluate(reminders, snapshot(ago(50 * MINUTE_MS), { at: ago(2 * 3_600_000), error: "db down" }), NOW, ago(DAY_MS));

    expect(status).toMatchObject({ ok: false, reason: "stale", lastRunFailed: false });
  });

  it("scales the allowance to the job: a daily job may be up to three days quiet", () => {
    expect(JobHealth.evaluate(daily, snapshot(ago(2.9 * DAY_MS)), NOW, ago(10 * DAY_MS)).ok).toBe(true);
    expect(JobHealth.evaluate(daily, snapshot(ago(3.1 * DAY_MS)), NOW, ago(10 * DAY_MS)).ok).toBe(false);
  });

  it("is failing as soon as the newest run failed after the last success, even inside the allowance", () => {
    const status = JobHealth.evaluate(daily, snapshot(ago(2 * 3_600_000), { at: ago(60_000), error: "boom" }), NOW, ago(10 * DAY_MS));

    expect(status).toMatchObject({ ok: false, reason: "failing", lastRunFailed: true });
  });

  it("is healthy again once a run succeeds after the failure", () => {
    const status = JobHealth.evaluate(daily, snapshot(ago(60_000), { at: ago(2 * 3_600_000), error: "old" }), NOW, ago(10 * DAY_MS));

    expect(status).toMatchObject({ ok: true, reason: "ok", lastRunFailed: false });
  });

  it("gives a job that has never succeeded the same allowance from when tracking began, so a fresh deploy is not an outage", () => {
    expect(JobHealth.evaluate(daily, undefined, NOW, ago(DAY_MS))).toMatchObject({ ok: true, reason: "not-yet-run" });
    expect(JobHealth.evaluate(daily, undefined, NOW, null)).toMatchObject({ ok: true, reason: "not-yet-run" });
  });

  it("flags a job that never succeeded once tracking has run for longer than its allowance", () => {
    expect(JobHealth.evaluate(daily, undefined, NOW, ago(4 * DAY_MS))).toMatchObject({ ok: false, reason: "never-ran" });
    expect(JobHealth.evaluate(reminders, snapshot(null, { at: ago(MINUTE_MS), error: "boom" }), NOW, ago(DAY_MS))).toMatchObject({
      ok: false,
      reason: "failing",
      lastRunFailed: true,
    });
  });
});
