import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, Heart, MessageSquareReply, UserPlus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getCurrentUser } from "@/lib/auth";
import { getNotifications, type NotificationView } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { MarkRead } from "./mark-read";

export const metadata: Metadata = { title: "Bildirimler" };

const ICONS = { REPLY: MessageSquareReply, LIKE: Heart, FOLLOW: UserPlus } as const;

function describe(n: NotificationView) {
  if (n.type === "FOLLOW") return "seni takip etmeye başladı";
  const where = n.where ? ` (${n.where})` : "";
  return n.type === "REPLY" ? `yorumuna cevap verdi${where}` : `yorumunu beğendi${where}`;
}

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent("/bildirimler")}`);
  const notifications = await getNotifications(user.id);
  const unread = notifications.filter((n) => n.unread).length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-extrabold tracking-tight">Bildirimler</h1>
      <MarkRead unread={unread} />
      {notifications.length === 0 ? (
        <EmptyState
          icon={<Bell />}
          title="Henüz bildirim yok"
          text="Biri yorumuna cevap verince, yorumunu beğenince ya da seni takip edince burada görürsün."
        />
      ) : (
        <ol className="space-y-2">
          {notifications.map((n) => {
            const Icon = ICONS[n.type];
            return (
              <li key={n.id}>
                <Link
                  href={n.href}
                  className={cn(
                    "hover:border-primary/40 flex items-start gap-3 rounded-xl border p-3 transition-colors",
                    n.unread ? "bg-primary/10 border-primary/30" : "bg-card",
                  )}
                >
                  <span className="relative shrink-0">
                    <Avatar>
                      {n.actor.avatarUrl && <AvatarImage src={n.actor.avatarUrl} alt="" />}
                      <AvatarFallback>{n.actor.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <Icon
                      className={cn(
                        "bg-background absolute -right-1 -bottom-1 size-4 rounded-full p-0.5",
                        n.type === "LIKE" ? "fill-rose-500 text-rose-500" : "text-primary",
                      )}
                    />
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="font-bold">@{n.actor.username}</span> {describe(n)}
                    {n.snippet && (
                      <span className="text-muted-foreground mt-0.5 block truncate">&ldquo;{n.snippet}&rdquo;</span>
                    )}
                    <span className="text-muted-foreground mt-1 block text-xs">{n.createdLabel}</span>
                  </span>
                  {n.unread && <span aria-label="Yeni" className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" />}
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
