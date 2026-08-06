-- Contract step of the NotificationPreference extraction: drops the six
-- legacy boolean columns now that migration
-- 20260805230159_backfill_notification_preferences_from_legacy_columns has
-- copied every non-default (false) value into NotificationPreference. Any
-- value still `true` here needs no preservation — absence of a
-- NotificationPreference row already means "enabled", the same default
-- these columns had.
ALTER TABLE "public"."User"
DROP COLUMN "notifyCrewCheckin",
DROP COLUMN "notifyCheer",
DROP COLUMN "notifyCrewActivity",
DROP COLUMN "notifyAchievement",
DROP COLUMN "notifyFollowing",
DROP COLUMN "notifySessionReminder";
