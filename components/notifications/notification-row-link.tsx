"use client";

import { useTransition, type ReactNode } from "react";
import Link from "next/link";
import { markNotificationOpenedAction } from "@/lib/controllers/notificationController";

/**
 * Wraps a single notification row's Link so click-through can be recorded
 * (Notification.openedAt) without blocking navigation — the action fires
 * inside startTransition and the Link navigates immediately regardless of
 * how it resolves.
 */
export function NotificationRowLink({
  id,
  href,
  className,
  style,
  children,
}: {
  id: string;
  href: string;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  const [, startTransition] = useTransition();

  return (
    <Link
      href={href}
      className={className}
      style={style}
      prefetch={false}
      onClick={() => startTransition(() => markNotificationOpenedAction(id))}
    >
      {children}
    </Link>
  );
}
