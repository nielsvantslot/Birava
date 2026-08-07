import { describe, expect, it } from "vitest";
import { partitionBackupsForRetention } from "./backupRetention";
import type { BackupInfo } from "./backupRetention";

// A Wednesday, deliberately not a Monday or the 1st, so backups dated
// relative to it don't accidentally land on a weekly/monthly boundary.
const NOW = new Date("2026-08-05T03:17:00.000Z");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

function backup(pathname: string, uploadedAt: Date): BackupInfo {
  return { pathname, uploadedAt };
}

describe("partitionBackupsForRetention", () => {
  it("keeps everything from the last 14 days", () => {
    const backups = [backup("today", daysAgo(0)), backup("13-days", daysAgo(13))];
    const { keep, expire } = partitionBackupsForRetention(backups, NOW);
    expect(keep.map((b) => b.pathname)).toEqual(["today", "13-days"]);
    expect(expire).toHaveLength(0);
  });

  it("expires a non-Monday, non-first-of-month backup once past 14 days", () => {
    // 2026-07-15 is a Wednesday, not the 1st — plain daily backup, 21 days old.
    const backups = [backup("stale", new Date("2026-07-15T03:00:00.000Z"))];
    const { keep, expire } = partitionBackupsForRetention(backups, NOW);
    expect(keep).toHaveLength(0);
    expect(expire.map((b) => b.pathname)).toEqual(["stale"]);
  });

  it("keeps a Monday backup up to 90 days even after the 14-day daily window closes", () => {
    // 2026-06-01 is a Monday, 65 days before NOW.
    const monday = new Date("2026-06-01T03:00:00.000Z");
    const { keep, expire } = partitionBackupsForRetention([backup("monday-65d", monday)], NOW);
    expect(keep.map((b) => b.pathname)).toEqual(["monday-65d"]);
    expect(expire).toHaveLength(0);
  });

  it("expires a Monday backup once past 90 days", () => {
    const oldMonday = daysAgo(91);
    // Force it onto a Monday regardless of what daysAgo(91) lands on.
    const dayOffset = (oldMonday.getUTCDay() + 6) % 7; // days since most recent Monday
    oldMonday.setUTCDate(oldMonday.getUTCDate() - dayOffset);
    const ageDays = (NOW.getTime() - oldMonday.getTime()) / (24 * 60 * 60 * 1000);
    expect(oldMonday.getUTCDay()).toBe(1);
    expect(ageDays).toBeGreaterThan(90);

    const { keep, expire } = partitionBackupsForRetention([backup("old-monday", oldMonday)], NOW);
    expect(keep).toHaveLength(0);
    expect(expire.map((b) => b.pathname)).toEqual(["old-monday"]);
  });

  it("keeps a first-of-month backup up to 400 days", () => {
    const firstOfMonth = new Date("2025-09-01T03:00:00.000Z"); // ~338 days before NOW
    const { keep, expire } = partitionBackupsForRetention([backup("month-338d", firstOfMonth)], NOW);
    expect(keep.map((b) => b.pathname)).toEqual(["month-338d"]);
    expect(expire).toHaveLength(0);
  });

  it("expires a first-of-month backup once past 400 days", () => {
    const tooOld = new Date("2025-01-01T03:00:00.000Z"); // > 400 days before NOW
    const { keep, expire } = partitionBackupsForRetention([backup("month-too-old", tooOld)], NOW);
    expect(keep).toHaveLength(0);
    expect(expire.map((b) => b.pathname)).toEqual(["month-too-old"]);
  });
});
