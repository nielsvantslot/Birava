"use client";

import { useState } from "react";
import { PushSubscribeToggle } from "@/components/notifications/push-subscribe-toggle";
import { NotificationPreferenceToggles } from "@/components/notifications/notification-preference-toggles";
import type { NotificationPreferenceKey } from "@/lib/dtos";

type Preferences = Record<NotificationPreferenceKey, boolean>;

/**
 * Wires PushSubscribeToggle's live subscription status into
 * NotificationPreferenceToggles' `disabled` prop — the two were previously
 * independent components with no shared state, which is how the category
 * list ended up fully interactive even while push was off.
 */
export function NotificationSettings({ initial }: { initial: Preferences }) {
  const [pushOn, setPushOn] = useState(false);

  return (
    <>
      <PushSubscribeToggle onStatusChange={setPushOn} />
      <NotificationPreferenceToggles initial={initial} disabled={!pushOn} />
    </>
  );
}
