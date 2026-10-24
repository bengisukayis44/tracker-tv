import type { Metadata } from "next";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ADMIN_USERS_PAGE, getAdminUsers } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Kullanıcılar" };

const joined = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Istanbul",
});

function pageHref(q: string, page: number) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("sayfa", String(page));
  const qs = params.toString();
  return qs ? `/admin/kullanicilar?${qs}` : "/admin/kullanicilar";
}

/** Members, newest first, searchable by name or e-mail. */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sayfa?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const page = Math.max(1, Number.parseInt(params.sayfa ?? "1", 10) || 1);
  const { total, users } = await getAdminUsers(q, page);
  const pages = Math.max(1, Math.ceil(total / ADMIN_USERS_PAGE));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight">Kullanıcılar</h1>
        <p className="text-muted-foreground text-sm">{q ? `"${q}" için ${total} kullanıcı` : `${total} üye`}</p>
      </div>
      <form action="/admin/kullanicilar" role="search" className="flex max-w-xl gap-2">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Kullanıcı adı ya da e-posta…"
            aria-label="Kullanıcı ara"
            className="h-10 pl-9"
          />
        </div>
        <Button type="submit" size="lg" className="h-10">
          Ara
        </Button>
      </form>

      {users.length === 0 ? (
        <EmptyState icon={<Users />} title="Kullanıcı bulunamadı" text="Farklı bir ad ya da e-posta dene." />
      ) : (
        <ul aria-label="Kullanıcı listesi" className="divide-y rounded-2xl border">
          {users.map((u) => (
            <li key={u.id}>
              <Link href={`/admin/kullanicilar/${u.id}`} className="hover:bg-muted/50 flex items-center gap-3 p-3">
                <Avatar>
                  {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt="" />}
                  <AvatarFallback>{u.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2">
                    <span className="truncate font-semibold">@{u.username}</span>
                    {u.isAdmin && <span className="text-primary text-xs font-semibold">Yönetici</span>}
                    {u.suspendedAt && <span className="text-destructive text-xs font-semibold">Askıda</span>}
                    {u.isPrivate && <span className="text-muted-foreground text-xs">Gizli profil</span>}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {u.email} · {joined.format(u.createdAt)}
                  </span>
                </span>
                <span className="text-muted-foreground hidden shrink-0 text-right text-xs sm:block">
                  {u._count.watchedEpisodes} bölüm · {u._count.watchedMovies} film
                  <br />
                  {u._count.comments} yorum
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Sayfalar" className="flex items-center justify-between gap-2 text-sm">
          {page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(q, page - 1)}>Önceki</Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            Sayfa {page} / {pages}
          </span>
          {page < pages ? (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(q, page + 1)}>Sonraki</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
