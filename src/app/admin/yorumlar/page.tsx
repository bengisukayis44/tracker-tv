import type { Metadata } from "next";
import Link from "next/link";
import { Flag, MessageSquare } from "lucide-react";
import { AdminCommentList } from "@/components/admin/admin-comment-list";
import { EmptyState } from "@/components/empty-state";
import { getAdminComments } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Yorumlar" };

const TABS = [
  { value: "sikayetler", label: "Şikayet edilenler" },
  { value: "son", label: "Son yorumlar" },
] as const;

/** Reported comments first (most reported on top), or the latest 100 comments. */
export default async function AdminCommentsPage({ searchParams }: { searchParams: Promise<{ sekme?: string }> }) {
  await requireAdmin();
  const tab = (await searchParams).sekme === "son" ? "son" : "sikayetler";
  const comments = await getAdminComments({}, 100, tab === "sikayetler");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold tracking-tight">Yorumlar</h1>
      <nav aria-label="Yorum listeleri" className="bg-muted inline-flex rounded-lg p-1">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={t.value === "sikayetler" ? "/admin/yorumlar" : "/admin/yorumlar?sekme=son"}
            aria-current={tab === t.value ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
              tab === t.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {comments.length > 0 ? (
        <AdminCommentList comments={comments} />
      ) : tab === "sikayetler" ? (
        <EmptyState
          icon={<Flag />}
          title="Bekleyen şikayet yok"
          text="Kullanıcılar bir yorumu şikayet edince burada görünür."
        />
      ) : (
        <EmptyState icon={<MessageSquare />} title="Henüz yorum yok" text="Yazılan yorumlar burada görünür." />
      )}
    </div>
  );
}
