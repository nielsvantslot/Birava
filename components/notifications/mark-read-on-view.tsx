"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markNotificationsRead } from "@/lib/controllers/notificationController";

/**
 * Marks all notifications read on an actual visit to /notifications, not
 * during RSC prefetch (which would fire before the user really saw the list).
 */
export function MarkReadOnView() {
  const router = useRouter();

  useEffect(() => {
    markNotificationsRead().then(() => router.refresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
