import "server-only";
import webpush, { WebPushError } from "web-push";
import { prisma } from "@/lib/prisma";
import type { PushMessage } from "@/lib/notify";

/** Push needs the VAPID key pair; without it notifications are simply off. */
export function isPushEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    "https://tracker-tv-seven.vercel.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

/**
 * Sends the messages to every browser the user turned notifications on in. Subscriptions the browser has
 * dropped (404/410) are deleted. Returns how many notifications were delivered.
 */
export async function pushToUser(userId: string, messages: PushMessage[]): Promise<number> {
  if (!isPushEnabled() || messages.length === 0) return 0;
  configure();
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  let delivered = 0;
  for (const sub of subscriptions) {
    for (const message of messages) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(message),
          { TTL: 24 * 60 * 60 },
        );
        delivered++;
      } catch (error) {
        if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
          await prisma.pushSubscription.deleteMany({ where: { id: sub.id } });
          break;
        }
        console.error("Bildirim gönderilemedi:", error);
      }
    }
  }
  return delivered;
}
