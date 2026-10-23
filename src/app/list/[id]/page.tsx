import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ListVideo, Lock } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ListOwnerControls, RemoveFromListButton } from "@/components/lists/list-controls";
import { PosterCard } from "@/components/poster-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getCurrentUser } from "@/lib/auth";
import { titleHref } from "@/lib/catalog";
import { getList } from "@/lib/lists";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ id }, user] = await Promise.all([params, getCurrentUser()]);
  const list = await getList(id, user?.id ?? null);
  return { title: list ? list.name : "Liste bulunamadı" };
}

export default async function ListPage({ params }: Props) {
  const [{ id }, user] = await Promise.all([params, getCurrentUser()]);
  const list = await getList(id, user?.id ?? null);
  if (!list) notFound();
  const profileHref = `/profile/${list.user.username}`;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight">
            <span className="truncate">{list.name}</span>
            {!list.isPublic && <Lock aria-label="Gizli liste" className="text-muted-foreground size-5 shrink-0" />}
          </h1>
          {list.description && <p className="text-foreground/85 max-w-2xl">{list.description}</p>}
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Link href={profileHref} className="hover:text-foreground inline-flex items-center gap-1.5 font-semibold">
              <Avatar className="size-5">
                {list.user.avatarUrl && <AvatarImage src={list.user.avatarUrl} alt="" />}
                <AvatarFallback className="text-[9px]">{list.user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              @{list.user.username}
            </Link>
            · {list.items.length} yapım
          </p>
        </div>
        {list.isOwner && <ListOwnerControls list={list} profileHref={profileHref} />}
      </header>

      {list.items.length === 0 ? (
        <EmptyState
          icon={<ListVideo />}
          title="Liste boş"
          text={
            list.isOwner
              ? "Dizi ve film sayfalarındaki “Listeye ekle” ile bu listeye yapım ekleyebilirsin."
              : "Bu listede henüz bir şey yok."
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {list.items.map(({ title }) => (
            <div key={title.id} className="space-y-1">
              <PosterCard
                href={titleHref(title.type, title.tmdbId!)}
                title={title.name}
                posterUrl={title.posterUrl}
                badge={title.type === "MOVIE" ? "Film" : "Dizi"}
                subtitle={title.releaseDate?.getFullYear()?.toString()}
              />
              {list.isOwner && <RemoveFromListButton listId={list.id} titleId={title.id} name={title.name} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
