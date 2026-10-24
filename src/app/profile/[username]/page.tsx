import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bookmark, Clapperboard, Film, Heart, ListVideo, Lock, MessageSquare, Settings, Tv } from "lucide-react";
import { SpoilerBlur } from "@/components/comments/spoiler-blur";
import { EmptyState } from "@/components/empty-state";
import { ListCard } from "@/components/lists/list-card";
import { NewListButton } from "@/components/lists/list-controls";
import { PosterCard } from "@/components/poster-card";
import { ProfileTabs } from "@/components/profile/profile-tabs";
import { CoverCharacterPicker } from "@/components/profile/cover-character-picker";
import { CoverPicker } from "@/components/profile/cover-picker";
import { FavoriteCharacters } from "@/components/profile/favorite-characters";
import { ProfileCover } from "@/components/profile/profile-cover";
import { SeriesProgressCard } from "@/components/profile/series-progress-card";
import { FollowButton } from "@/components/social/follow-button";
import { WatchlistRemoveButton } from "@/components/profile/watchlist-remove-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { getUserLists } from "@/lib/lists";
import { getFollowState } from "@/lib/social";
import { coverImageUrl } from "@/lib/cover";
import { formatWatchTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  getCoverCharacter,
  getFavoriteCharacters,
  getFavorites,
  getProfileUser,
  getSeriesProgress,
  getUserComments,
  getWatchedMovies,
  getWatchlist,
  getWatchStats,
  type ProfileComment,
} from "@/lib/profile";

type Props = { params: Promise<{ username: string }>; searchParams: Promise<{ sekme?: string }> };

const memberSince = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "Europe/Istanbul" });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const user = await getProfileUser(decodeURIComponent((await params).username));
  return { title: user ? `@${user.username}` : "Kullanıcı bulunamadı" };
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const [{ username }, { sekme }] = await Promise.all([params, searchParams]);
  const [user, viewer] = await Promise.all([getProfileUser(decodeURIComponent(username)), getCurrentUser()]);
  if (!user) notFound();
  const isMe = viewer?.id === user.id;
  const follow = await getFollowState(user.id, viewer?.id ?? null);

  // The cover is part of the profile, so a private one keeps it to its owner
  const visible = isMe || !user.isPrivate;
  const cover = user.coverPath && visible ? coverImageUrl(user.coverPath) : null;
  const character = visible ? await getCoverCharacter(user) : null;
  const hasCover = Boolean(cover || character);

  const header = (
    <div>
      {hasCover ? (
        <ProfileCover
          scene={cover ? { src: cover, positionY: user.coverPositionY } : null}
          character={character}
          isMe={isMe}
        />
      ) : (
        isMe && (
          <div className="text-muted-foreground -mx-4 flex h-28 flex-wrap items-center justify-center gap-2 border-y border-dashed sm:mx-0 sm:rounded-3xl sm:border">
            <CoverPicker hasCover={false} />
            <CoverCharacterPicker hasCharacter={false} />
          </div>
        )
      )}
      <header className={cn("relative flex flex-wrap items-center gap-4", hasCover && "-mt-10 sm:-mt-14 sm:px-6")}>
        <Avatar className={cn("size-16 text-xl", hasCover && "ring-background size-20 ring-4 sm:size-24")}>
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
          <AvatarFallback>{user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="inline-flex max-w-full items-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            <span className="truncate">@{user.username}</span>
            {user.isPrivate && <Lock aria-label="Gizli profil" className="text-muted-foreground size-5 shrink-0" />}
          </h1>
          <p className="text-muted-foreground text-sm">
            {memberSince.format(user.createdAt)}&apos;den beri üye ·{" "}
            <Link href={`/profile/${user.username}/takipciler`} className="hover:text-foreground hover:underline">
              <span className="text-foreground font-semibold">{follow.followers}</span> takipçi
            </Link>{" "}
            ·{" "}
            <Link href={`/profile/${user.username}/takip-edilenler`} className="hover:text-foreground hover:underline">
              <span className="text-foreground font-semibold">{follow.following}</span> takip
            </Link>
          </p>
        </div>
        {/* On phones the button gets its own line, so the name is not squeezed */}
        <div className="basis-full sm:basis-auto">
          {!isMe && !user.isPrivate && (
            <FollowButton
              userId={user.id}
              username={user.username}
              isFollowing={follow.isFollowing}
              signedIn={viewer !== null}
            />
          )}
          {isMe && (
            <Button asChild variant="outline">
              <Link href="/settings">
                <Settings />
                Profili düzenle
              </Link>
            </Button>
          )}
        </div>
      </header>
    </div>
  );

  // A private profile shows only who it is to everyone but its owner
  if (user.isPrivate && !isMe) {
    return (
      <div className="space-y-8">
        {header}
        <EmptyState
          icon={<Lock />}
          title="Bu profil gizli"
          text={`@${user.username} izlediklerini yalnızca kendisi görebilecek şekilde ayarlamış.`}
        />
      </div>
    );
  }

  const [stats, series, movies, favorites, comments, watchlist, characters, lists] = await Promise.all([
    getWatchStats(user.id),
    getSeriesProgress(user.id),
    getWatchedMovies(user.id),
    getFavorites(user.id),
    getUserComments(user.id),
    getWatchlist(user.id),
    getFavoriteCharacters(user.id),
    getUserLists(user.id, isMe),
  ]);
  const favoriteSeries = favorites.filter((f) => f.title.type === "SERIES");
  const favoriteMovies = favorites.filter((f) => f.title.type === "MOVIE");
  const titleHref = (t: { type: string; tmdbId: number | null }) =>
    t.type === "MOVIE" ? `/movie/${t.tmdbId}` : `/series/${t.tmdbId}`;
  const owner = isMe ? "Henüz" : `@${user.username} henüz`;

  return (
    <div className="space-y-8">
      {header}

      <section aria-label="İzleme süresi" className="grid gap-3 sm:grid-cols-2">
        <WatchTimeStat
          icon={<Tv />}
          label="Dizi izleme süresi"
          value={formatWatchTime(stats.seriesMinutes)}
          detail={withRewatches(`${stats.episodeCount} bölüm`, stats.episodeRewatches)}
        />
        <WatchTimeStat
          icon={<Film />}
          label="Film izleme süresi"
          value={formatWatchTime(stats.movieMinutes)}
          detail={withRewatches(`${stats.movieCount} film`, stats.movieRewatches)}
        />
      </section>

      <FavoriteCharacters characters={characters} isMe={isMe} />

      <ProfileTabs
        initial={sekme ?? "diziler"}
        tabs={[
          {
            value: "diziler",
            label: isMe ? "İzlediğim Diziler" : "İzlediği Diziler",
            count: series.length,
            panel:
              series.length === 0 ? (
                <EmptyState icon={<Tv />} title="Dizi yok" text={`${owner} bir dizi bölümü izlemedi.`} />
              ) : (
                <Grid>
                  {series.map((s) => (
                    <SeriesProgressCard key={s.id} series={s} />
                  ))}
                </Grid>
              ),
          },
          {
            value: "filmler",
            label: isMe ? "İzlediğim Filmler" : "İzlediği Filmler",
            count: movies.length,
            panel:
              movies.length === 0 ? (
                <EmptyState icon={<Film />} title="Film yok" text={`${owner} bir film izlemedi.`} />
              ) : (
                <Grid>
                  {movies.map((m) => (
                    <PosterCard
                      key={m.title.id}
                      href={titleHref(m.title)}
                      title={m.title.name}
                      posterUrl={m.title.posterUrl}
                      subtitle={[m.title.releaseDate?.getFullYear(), m.rating != null && `Puan: ${m.rating}/10`]
                        .filter(Boolean)
                        .join(" · ")}
                    />
                  ))}
                </Grid>
              ),
          },
          {
            value: "favoriler",
            label: isMe ? "Favorilerim" : "Favorileri",
            count: favorites.length,
            panel:
              favorites.length === 0 ? (
                <EmptyState icon={<Heart />} title="Favori yok" text={`${owner} favorilere bir şey eklemedi.`} />
              ) : (
                <div className="space-y-8">
                  {[
                    { heading: "Favori Diziler", items: favoriteSeries },
                    { heading: "Favori Filmler", items: favoriteMovies },
                  ].map(({ heading, items }) => (
                    <section key={heading} className="space-y-3">
                      <h2 className="text-lg font-bold">{heading}</h2>
                      {items.length === 0 ? (
                        <p className="text-muted-foreground text-sm">Henüz yok.</p>
                      ) : (
                        <Grid>
                          {items.map((f) => (
                            <PosterCard
                              key={f.title.id}
                              href={titleHref(f.title)}
                              title={f.title.name}
                              posterUrl={f.title.posterUrl}
                              subtitle={f.title.releaseDate?.getFullYear()?.toString()}
                            />
                          ))}
                        </Grid>
                      )}
                    </section>
                  ))}
                </div>
              ),
          },
          {
            value: "listeler",
            label: isMe ? "Listelerim" : "Listeleri",
            count: lists.length,
            panel: (
              <div className="space-y-4">
                {isMe && <NewListButton />}
                {lists.length === 0 ? (
                  <EmptyState
                    icon={<ListVideo />}
                    title="Liste yok"
                    text={
                      isMe
                        ? "Kendi listelerini oluştur: dizi ve film sayfalarındaki “Listeye ekle” ya da yukarıdaki “Yeni liste”."
                        : `@${user.username} henüz herkese açık bir liste oluşturmadı.`
                    }
                  />
                ) : (
                  <Grid>
                    {lists.map((list) => (
                      <ListCard key={list.id} list={list} />
                    ))}
                  </Grid>
                )}
              </div>
            ),
          },
          {
            value: "yorumlar",
            label: isMe ? "Yorumlarım" : "Yorumları",
            count: comments.length,
            panel:
              comments.length === 0 ? (
                <EmptyState icon={<MessageSquare />} title="Yorum yok" text={`${owner} yorum yazmadı.`} />
              ) : (
                <ul className="divide-y">
                  {comments.map((c) => (
                    <ProfileCommentItem key={c.id} comment={c} spoilersRevealed={isMe} />
                  ))}
                </ul>
              ),
          },
          {
            value: "sonra",
            label: "Daha Sonra İzle",
            count: watchlist.length,
            panel:
              watchlist.length === 0 ? (
                <EmptyState icon={<Bookmark />} title="Liste boş" text={`${owner} listesine bir şey eklemedi.`} />
              ) : (
                <Grid>
                  {watchlist.map((w) => (
                    <div key={w.title.id} className="space-y-1">
                      <PosterCard
                        href={titleHref(w.title)}
                        title={w.title.name}
                        posterUrl={w.title.posterUrl}
                        badge={w.title.type === "MOVIE" ? "Film" : "Dizi"}
                      />
                      {isMe && <WatchlistRemoveButton titleId={w.title.id} name={w.title.name} />}
                    </div>
                  ))}
                </Grid>
              ),
          },
        ]}
      />
    </div>
  );
}

/** "12 bölüm · 3 tekrar izleme" */
const withRewatches = (text: string, rewatches: number) =>
  rewatches > 0 ? `${text} · ${rewatches} tekrar izleme` : text;

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">{children}</div>;
}

/** Toplam izleme süresi kartı (PROJE_PLANI.md §8: WatchTimeStat). */
function WatchTimeStat({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="bg-card flex items-center gap-4 rounded-2xl border p-5">
      <span className="bg-primary/10 text-primary rounded-xl p-3 [&_svg]:size-6">{icon}</span>
      <dl className="min-w-0">
        <dt className="text-muted-foreground text-sm">{label}</dt>
        <dd className="text-2xl font-extrabold tracking-tight">{value}</dd>
        <dd className="text-muted-foreground text-sm">{detail}</dd>
      </dl>
    </div>
  );
}

function ProfileCommentItem({ comment, spoilersRevealed }: { comment: ProfileComment; spoilersRevealed: boolean }) {
  const text = <p className="text-foreground/90 break-words whitespace-pre-wrap">{comment.content}</p>;
  return (
    <li className="space-y-2 py-4">
      <Link href={comment.href} className="hover:text-primary inline-flex items-start gap-2 font-semibold">
        <Clapperboard className="mt-0.5 size-4 shrink-0" />
        <span>
          <em className="not-italic">{comment.titleName}</em>
          {comment.episodeLabel && <span className="text-muted-foreground"> — {comment.episodeLabel}</span>}
        </span>
      </Link>
      {comment.isSpoiler ? <SpoilerBlur initiallyRevealed={spoilersRevealed}>{text}</SpoilerBlur> : text}
      <p className="text-muted-foreground flex gap-3 text-xs">
        <time dateTime={comment.createdAt}>{comment.createdLabel}</time>
        <span>{comment.likeCount} beğeni</span>
      </p>
    </li>
  );
}
