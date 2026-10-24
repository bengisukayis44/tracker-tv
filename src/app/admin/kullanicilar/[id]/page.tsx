import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, ExternalLink, RotateCcw, Trash2 } from "lucide-react";
import { deleteUserAccount, setSuspended } from "@/app/actions/admin";
import { AdminCommentList } from "@/components/admin/admin-comment-list";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAdminUser } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Kullanıcı" };

const dateTime = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Istanbul",
});

/** One member: what they did, their latest comments, and suspend / delete. */
export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const user = await getAdminUser((await params).id);
  if (!user) notFound();
  const canAct = user.id !== admin.id && !user.isAdmin;

  const facts = [
    ["Üyelik", dateTime.format(user.createdAt)],
    ["Son izleme", user.lastWatchAt ? dateTime.format(user.lastWatchAt) : "Yok"],
    ["İzlenen", `${user._count.watchedEpisodes} bölüm · ${user._count.watchedMovies} film`],
    ["Yorumlar", `${user._count.comments} yorum · ${user.reportsAgainst} şikayet aldı`],
    ["Takip", `${user._count.followers} takipçi · ${user._count.following} takip`],
    ["Listeler", String(user._count.lists)],
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/admin/kullanicilar"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        Kullanıcılar
      </Link>

      <header className="flex flex-wrap items-center gap-4">
        <Avatar className="size-16 text-xl">
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
          <AvatarFallback>{user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold tracking-tight">@{user.username}</h1>
          <p className="text-muted-foreground truncate text-sm">{user.email}</p>
          <p className="flex flex-wrap gap-x-2 text-sm">
            {user.isAdmin && <span className="text-primary font-semibold">Yönetici</span>}
            {user.suspendedAt && (
              <span className="text-destructive font-semibold">
                {dateTime.format(user.suspendedAt)} tarihinden beri askıda
              </span>
            )}
            {user.isPrivate && <span className="text-muted-foreground">Gizli profil</span>}
          </p>
        </div>
        <Link
          href={`/profile/${user.username}`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          Profili aç
          <ExternalLink className="size-4" />
        </Link>
      </header>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map(([term, value]) => (
          <div key={term} className="bg-card rounded-xl border p-3">
            <dt className="text-muted-foreground text-xs">{term}</dt>
            <dd className="font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      {canAct && (
        <section aria-labelledby="actions-heading" className="space-y-2">
          <h2 id="actions-heading" className="text-lg font-bold">
            İşlemler
          </h2>
          <div className="flex flex-wrap gap-2">
            {user.suspendedAt ? (
              <ConfirmButton
                action={setSuspended.bind(null, user.id, false)}
                done={`@${user.username} askıdan çıkarıldı.`}
              >
                <RotateCcw />
                Askıdan çıkar
              </ConfirmButton>
            ) : (
              <ConfirmButton
                action={setSuspended.bind(null, user.id, true)}
                done={`@${user.username} askıya alındı.`}
                confirm={{
                  title: `@${user.username} askıya alınsın mı?`,
                  text: "Oturumu kapanır, giriş yapamaz ve hiçbir şey yapamaz. Verileri silinmez; istediğin zaman askıdan çıkarabilirsin.",
                  label: "Askıya al",
                }}
              >
                <Ban />
                Askıya al
              </ConfirmButton>
            )}
            <ConfirmButton
              variant="destructive"
              action={deleteUserAccount.bind(null, user.id)}
              done={`@${user.username} hesabı silindi.`}
              redirectTo="/admin/kullanicilar"
              confirm={{
                title: `@${user.username} hesabı silinsin mi?`,
                text: "Hesap, izleme geçmişi, yorumları, listeleri ve takipleri kalıcı olarak silinir. Bu geri alınamaz.",
                label: "Hesabı sil",
              }}
            >
              <Trash2 />
              Hesabı sil
            </ConfirmButton>
          </div>
        </section>
      )}

      <section aria-labelledby="comments-heading" className="space-y-3">
        <h2 id="comments-heading" className="text-lg font-bold">
          Son yorumları
        </h2>
        {user.comments.length > 0 ? (
          <AdminCommentList comments={user.comments} showAuthor={false} />
        ) : (
          <p className="text-muted-foreground text-sm">Henüz yorum yazmamış.</p>
        )}
      </section>
    </div>
  );
}
