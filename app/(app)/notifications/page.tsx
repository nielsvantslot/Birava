import { Suspense } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserTimeZone } from "@/lib/timezone";
import {
  getMyNotifications,
  getMyHasPushSubscription,
  getMyUnreadNotificationCount,
} from "@/lib/controllers/notificationController";
import { timeAgo } from "@/lib/dates";
import { avatarSrc, cn } from "@/lib/utils";
import { MarkReadOnView } from "@/components/notifications/mark-read-on-view";
import { CrewInviteActions } from "@/components/notifications/crew-invite-actions";
import { Skeleton } from "@/components/ui/skeleton";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <>
      {/* Its own streaming slot — skips the mark-read mutation and the
          router.refresh() round trip entirely when nothing is unread
          (the common repeat-visit case), instead of firing both on every
          visit regardless. */}
      <Suspense fallback={null}>
        <MarkReadGate />
      </Suspense>

      {/* Independent from the notification list below — streams in on its
          own instead of both waiting on whichever query is slower. */}
      <Suspense fallback={null}>
        <PushNudgeLoader />
      </Suspense>

      <Suspense fallback={<NotificationListSkeleton />}>
        <NotificationListLoader />
      </Suspense>
    </>
  );
}

async function MarkReadGate() {
  const unreadCount = await getMyUnreadNotificationCount();
  if (unreadCount === 0) return null;

  return <MarkReadOnView />;
}

async function PushNudgeLoader() {
  const hasPush = await getMyHasPushSubscription();
  if (hasPush) return null;

  return (
    <div className="callout" style={{ margin: "16px" }}>
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
          <Link href="/settings/notifications#push-notifications" style={{ color: "var(--accent)", fontWeight: 700 }}>
            Turn on
          </Link>
        </p>
      </div>
    </div>
  );
}

async function NotificationListLoader() {
  const [tz, notifications] = await Promise.all([
    getUserTimeZone(),
    getMyNotifications(),
  ]);

  return (
    <div className="section">
      {notifications.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--ink-dim)" }}>
          No notifications yet.
        </p>
      ) : (
        notifications.map((n) => {
          const avatar = (
            <div className="rowmark">
              {n.actorAvatarUrl && n.actorId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarSrc(n.actorId)}
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
          );

          if (n.type === "CREW_INVITE" && n.inviteId) {
            return (
              <div key={n.id} className={cn("row", !n.read && "unread")}>
                {avatar}
                <div className="grow">
                  <b>{n.message}</b>
                  <span>{timeAgo(new Date(n.createdAt), tz)}</span>
                </div>
                <CrewInviteActions inviteId={n.inviteId} />
              </div>
            );
          }

          return (
            <Link
              key={n.id}
              href={n.href}
              className={cn("row", !n.read && "unread")}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              {avatar}
              <div className="grow">
                <b>{n.message}</b>
                <span>{timeAgo(new Date(n.createdAt), tz)}</span>
              </div>
              <span className="chev">›</span>
            </Link>
          );
        })
      )}
    </div>
  );
}

function NotificationListSkeleton() {
  return (
    <div className="section">
      {[...Array(6)].map((_, i) => (
        <div className="row" key={i}>
          <div className="rowmark">
            <Skeleton className="h-full w-full rounded-full" />
          </div>
          <div className="grow space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
