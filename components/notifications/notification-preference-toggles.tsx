"use client";

import { useState, useTransition } from "react";
import { updateNotificationPreference } from "@/lib/controllers/notificationController";
import type { NotificationPreferenceKey } from "@/lib/dtos";
import { showToast } from "@/components/ui/toast-pill";

type Preferences = Record<NotificationPreferenceKey, boolean>;

const CATEGORIES: { key: NotificationPreferenceKey; label: string; description: string }[] = [
  {
    key: "notifyCrewCheckin",
    label: "Crew sessions",
    description: "Someone in a crew starts a session.",
  },
  {
    key: "notifyCheer",
    label: "Cheers",
    description: "Someone cheers one of your check-ins.",
  },
  {
    key: "notifyCrewActivity",
    label: "Crew activity",
    description: "Joins and other crew activity.",
  },
  {
    key: "notifyAchievement",
    label: "Achievements",
    description: "You unlock a new achievement.",
  },
  {
    key: "notifyFollowing",
    label: "Following",
    description: "New followers, and sessions from people you follow.",
  },
];

/**
 * Per-category gate on whether a Notification row is even created
 * (lib/notify.ts), not just whether push fires. The master push
 * subscribe/unsubscribe switch (PushSubscribeToggle) is a separate, coarser
 * control above this one.
 */
export function NotificationPreferenceToggles({ initial }: { initial: Preferences }) {
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
    <div className="section">
      <div className="h-row" style={{ marginBottom: 6 }}>
        <h3>Notify me about</h3>
      </div>
      {CATEGORIES.map(({ key, label, description }) => (
        <div className="switch-row" key={key}>
          <div className="grow">
            <b>{label}</b>
            <p>{description}</p>
          </div>
          <button
            role="switch"
            aria-checked={prefs[key]}
            aria-label={label}
            className={`switch${prefs[key] ? " on" : ""}`}
            disabled={pendingKey === key}
            onClick={() => handleToggle(key)}
          />
        </div>
      ))}
    </div>
  );
}
