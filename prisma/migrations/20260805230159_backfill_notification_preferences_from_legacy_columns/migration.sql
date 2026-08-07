-- Data migration: preserves every user's actual notification preferences
-- into NotificationPreference before the legacy boolean columns are
-- dropped (separate, later migration). NotificationPreference is sparse by
-- design (absence of a row means "enabled", the default for every
-- category) — so only users who explicitly turned a category OFF need a
-- row here; everyone still on the default (the vast majority) needs
-- nothing, which is exactly what keeps this table small.
INSERT INTO "public"."NotificationPreference" ("userId", "key", "enabled")
SELECT id, 'notifyCrewCheckin', false FROM "public"."User" WHERE "notifyCrewCheckin" = false
UNION ALL
SELECT id, 'notifyCheer', false FROM "public"."User" WHERE "notifyCheer" = false
UNION ALL
SELECT id, 'notifyCrewActivity', false FROM "public"."User" WHERE "notifyCrewActivity" = false
UNION ALL
SELECT id, 'notifyAchievement', false FROM "public"."User" WHERE "notifyAchievement" = false
UNION ALL
SELECT id, 'notifyFollowing', false FROM "public"."User" WHERE "notifyFollowing" = false
UNION ALL
SELECT id, 'notifySessionReminder', false FROM "public"."User" WHERE "notifySessionReminder" = false;
