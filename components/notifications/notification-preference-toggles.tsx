"use client";

import { useState, useTransition } from "react";
import { updateNotificationPreference } from "@/lib/controllers/notificationController";
import type { NotificationPreferenceKey } from "@/lib/dtos";
import { showToast } from "@/components/ui/toast-pill";

type Preferences = Record<NotificationPreferenceKey, boolean>;
type Category = { key: NotificationPreferenceKey; label: string; description: string };

// Grouped by who triggers the event, not alphabetically — Crew sessions and
// Crew activity are both "someone in your crew did something"; Cheers &
// comments and Following are both another person reacting to or following
// you; Achievements and Session reminders are both the system telling you
// about your own activity, nobody else involved.
const GROUPS: { label: string; items: Category[] }[] = [
  {
    label: "Crew",
    items: [
      {
        key: "notifyCrewCheckin",
        label: "Crew sessions",
        description: "Someone in a crew logs a check-in that starts a new session.",
      },
      {
        key: "notifyCrewActivity",
        label: "Crew activity",
        description: "Someone joins your crew, or invites you to one — not check-ins (see Crew sessions).",
      },
    ],
  },
  {
    label: "Social",
    items: [
      {
        key: "notifyCheer",
        label: "Cheers & comments",
        description: "Someone cheers or comments on one of your sessions.",
      },
      {
        key: "notifyFollowing",
        label: "Following",
        description: "New followers, and sessions from people you follow.",
      },
    ],
  },
  {
    label: "You",
    items: [
      {
        key: "notifyAchievement",
        label: "Achievements",
        description: "You unlock a new achievement.",
      },
      {
        key: "notifySessionReminder",
        label: "Session reminders",
        description: "A nudge to log if your current session goes quiet for a while.",
      },
    ],
  },
];

/**
 * Per-category gate on whether PUSH fires for that category (lib/notify.ts)
 * — the in-app notification list always shows every event regardless of
 * these toggles or of push being on at all. The master push
 * subscribe/unsubscribe switch (PushSubscribeToggle) is a separate, coarser
 * control rendered above this one on the same /settings/notifications screen
 * (app/(app)/settings/notifications/page.tsx) — reached via a single
 * "Notifications" row on the main /settings page, not shown inline there.
 *
 * Deliberately flat, icon-free rows with a hairline divider between them —
 * matches Instagram's own granular notification list (checked live: bold
 * label + control + a muted one-line example, repeated, no icons or nested
 * cards anywhere in it). Split into named groups (Crew/Social/You) rather
 * than one flat pile of six, same reason Instagram's own list is broken
 * into named clusters instead of one long list.
 *
 * `disabled` (driven by PushSubscribeToggle's live status, one level up on
 * /settings/notifications) greys out and locks every row while push is off
 * — these toggles are genuinely inert in that state (they only ever
 * controlled push), so disabling them is a correctness fix, not just a
 * visual one.
 */
export function NotificationPreferenceToggles({
  initial,
  disabled = false,
}: {
  initial: Preferences;
  disabled?: boolean;
}) {
  const [prefs, setPrefs] = useState(initial);
  const [pendingKey, setPendingKey] = useState<NotificationPreferenceKey | null>(null);
  const [, startTransition] = useTransition();

  const handleToggle = (key: NotificationPreferenceKey) => {
    const enabled = !prefs[key];
    setPrefs((p) => ({ ...p, [key]: enabled }));
    setPendingKey(key);
    startTransition(async () => {
      try {
        await updateNotificationPreference({ key, enabled });
      } catch {
        setPrefs((p) => ({ ...p, [key]: !enabled }));
        showToast("Couldn't update that setting.");
      } finally {
        setPendingKey(null);
      }
    });
  };

  return (
    <>
      {disabled && (
        <p style={{ fontSize: 13, color: "var(--ink-dim)", margin: "20px 0 0" }}>
          Turn on push notifications above to manage these.
        </p>
      )}
      {GROUPS.map(({ label, items }) => (
        <div key={label}>
          <div className="settings-subhead">{label}</div>
          {items.map(({ key, label, description }) => (
            <div className={`switch-row${pendingKey === key || disabled ? " pending" : ""}`} key={key}>
              <div className="grow">
                <b>{label}</b>
                <p>{description}</p>
              </div>
              <button
                role="switch"
                aria-checked={prefs[key]}
                aria-label={label}
                className={`switch${prefs[key] ? " on" : ""}`}
                disabled={disabled || pendingKey === key}
                onClick={() => handleToggle(key)}
              />
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
