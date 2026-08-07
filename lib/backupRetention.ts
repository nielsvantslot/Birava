const DAY_MS = 24 * 60 * 60 * 1000;

export type BackupInfo = {
  pathname: string;
  uploadedAt: Date;
};

/**
 * Grandfather-father-son retention for db-backup.yml's nightly dumps: every
 * backup from the last 14 days, Monday's backup for 90 days, and the
 * 1st-of-month backup for 400 days. Everything else expires. One copy per
 * day is stored (not three), so a backup can satisfy more than one window
 * at once — the checks are independent ORs, not mutually exclusive tiers.
 *
 * Deliberately not more aggressive than daily: Neon's own point-in-time
 * restore already covers the last 6 hours at second granularity, so this
 * exists for "nobody noticed for days/weeks/months," not for undoing the
 * last few minutes.
 */
export function partitionBackupsForRetention(
  backups: BackupInfo[],
  now: Date
): { keep: BackupInfo[]; expire: BackupInfo[] } {
  const keep: BackupInfo[] = [];
  const expire: BackupInfo[] = [];

  for (const backup of backups) {
    const ageDays = (now.getTime() - backup.uploadedAt.getTime()) / DAY_MS;
    const isMonday = backup.uploadedAt.getUTCDay() === 1;
    const isFirstOfMonth = backup.uploadedAt.getUTCDate() === 1;

    const withinDaily = ageDays <= 14;
    const withinWeekly = isMonday && ageDays <= 90;
    const withinMonthly = isFirstOfMonth && ageDays <= 400;

    (withinDaily || withinWeekly || withinMonthly ? keep : expire).push(backup);
  }

  return { keep, expire };
}
