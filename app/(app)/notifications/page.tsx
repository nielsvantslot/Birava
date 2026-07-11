import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserTimeZone } from "@/lib/timezone";
import {
  getMyNotifications,
  getMyHasPushSubscription,
} from "@/lib/controllers/notificationController";
import { timeAgo } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { MarkReadOnView } from "@/components/notifications/mark-read-on-view";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [tz, notifications, hasPush] = await Promise.all([
    getUserTimeZone(),
    getMyNotifications(),
    getMyHasPushSubscription(),
  ]);

  return (
    <>
      <MarkReadOnView />
      {!hasPush && (
        <div className="callout" style={{ margin: "16px 16px 0" }}>
          <div className="mark">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.7 21a2 2 0 01-3.4 0"></path>
            </svg>
          </div>
          <div>
            <b>Get notified instantly</b>
            <p>
              Turn on push notifications so you don&apos;t have to check back.{" "}
              <Link href="/profile#push-notifications" style={{ color: "var(--accent)", fontWeight: 700 }}>
                Turn on
              </Link>
            </p>
          </div>
        </div>
      )}
      <div className="section">
        {notifications.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--ink-dim)" }}>
            No notifications yet.
          </p>
        ) : (
          notifications.map((n) => (
            <Link
              key={n.id}
              href={n.href}
              className={cn("row", !n.read && "unread")}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div className="rowmark">
                {n.actorAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={n.actorAvatarUrl}
                    alt=""
                    style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
                  />
                ) : (
                  <svg viewBox="0 0 24 24">
                    <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.7 21a2 2 0 01-3.4 0"></path>
                  </svg>
                )}
              </div>
              <div className="grow">
                <b>{n.message}</b>
                <span>{timeAgo(new Date(n.createdAt), tz)}</span>
              </div>
              <span className="chev">›</span>
            </Link>
          ))
        )}
      </div>
    </>
  );
}
