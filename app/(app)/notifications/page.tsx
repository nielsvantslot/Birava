import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserTimeZone } from "@/lib/timezone";
import { getMyNotifications } from "@/lib/controllers/notificationController";
import { timeAgo } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { MarkReadOnView } from "@/components/notifications/mark-read-on-view";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [tz, notifications] = await Promise.all([
    getUserTimeZone(),
    getMyNotifications(),
  ]);

  return (
    <>
      <MarkReadOnView />
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
