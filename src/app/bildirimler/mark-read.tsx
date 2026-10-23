"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markNotificationsRead } from "@/app/actions/notifications";

/** Opening the page counts as reading: marks everything read, then refreshes so the bell's count goes. */
export function MarkRead({ unread }: { unread: number }) {
  const router = useRouter();
  useEffect(() => {
    if (unread === 0) return;
    markNotificationsRead().then((result) => {
      if (result.ok) router.refresh();
    });
  }, [unread, router]);
  return null;
}
