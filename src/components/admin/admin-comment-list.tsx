import Link from "next/link";
import { Check, Flag, Trash2 } from "lucide-react";
import { adminDeleteComment, dismissReports } from "@/app/actions/admin";
import type { AdminComment } from "@/lib/admin";
import { ConfirmButton } from "./confirm-button";

/** Comments with where they are, who wrote them, why they were reported, and delete / "Sorun yok". */
export function AdminCommentList({ comments, showAuthor = true }: { comments: AdminComment[]; showAuthor?: boolean }) {
  return (
    <ul className="divide-y rounded-2xl border">
      {comments.map((c) => (
        <li key={c.id}>
          <article aria-label={`@${c.author.username} yorumu`} className="space-y-2 p-4">
            <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
              {showAuthor && (
                <Link href={`/admin/kullanicilar/${c.author.id}`} className="hover:text-primary font-bold">
                  @{c.author.username}
                </Link>
              )}
              {c.where.href ? (
                <Link href={c.where.href} className="text-muted-foreground hover:text-foreground">
                  {c.where.label}
                </Link>
              ) : (
                <span className="text-muted-foreground">{c.where.label}</span>
              )}
              <span className="text-muted-foreground text-xs">{c.createdLabel}</span>
              {c.isReply && <span className="text-muted-foreground text-xs">(cevap)</span>}
              {c.isSpoiler && <span className="text-xs font-semibold text-orange-400">Spoiler</span>}
            </header>
            <p className="break-words whitespace-pre-wrap">{c.content}</p>
            {c.reportCount > 0 && (
              <p className="text-destructive inline-flex flex-wrap items-center gap-x-2 text-sm font-medium">
                <Flag className="size-4" />
                {c.reportCount} şikayet:
                <span>{c.reasons.map((r) => (r.count > 1 ? `${r.label} (${r.count})` : r.label)).join(", ")}</span>
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <ConfirmButton
                variant="destructive"
                action={adminDeleteComment.bind(null, c.id)}
                done="Yorum silindi."
                confirm={{
                  title: "Yorumu sil?",
                  text: "Yorum, cevapları ve beğenileri kalıcı olarak silinir.",
                  label: "Sil",
                }}
              >
                <Trash2 />
                Sil
              </ConfirmButton>
              {c.reportCount > 0 && (
                <ConfirmButton action={dismissReports.bind(null, c.id)} done="Şikayetler kapatıldı.">
                  <Check />
                  Sorun yok
                </ConfirmButton>
              )}
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
