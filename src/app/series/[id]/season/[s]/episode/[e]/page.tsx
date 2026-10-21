import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { CommentSection } from "@/components/comments/comment-section";
import { RatingBadge } from "@/components/rating-badge";
import { WatchPanel } from "@/components/watch/watch-panel";
import { getCurrentUser } from "@/lib/auth";
import { parseCast } from "@/lib/cast";
import { getComments } from "@/lib/comment-data";
import { getEpisodeWatch } from "@/lib/viewer";
import { findEpisodeWithNeighbors, isAired, type EpisodeRef } from "@/lib/episodes";
import { episodeCode, formatDate, formatRuntime, pickRating } from "@/lib/format";
import { loadSeries } from "../../../../data";
import { TitlePreparing } from "@/components/title-preparing";

type Props = { params: Promise<{ id: string; s: string; e: string }> };

async function loadEpisode(params: Props["params"]) {
  const { id, s, e } = await params;
  const series = await loadSeries(id);
  if (!series) return null;
  const found = findEpisodeWithNeighbors(series.seasons, Number(s), Number(e));
  if (!found) notFound();
  return { id, series, ...found };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const loaded = await loadEpisode(params);
  if (!loaded) return { title: "Dizi hazırlanıyor" };
  const { series, season, episode } = loaded;
  return {
    title: `${series.name} ${episodeCode(season.seasonNumber, episode.episodeNumber)}: ${episode.name}`,
    description: episode.overview ?? undefined,
  };
}

export default async function EpisodePage({ params }: Props) {
  const [loaded, user] = await Promise.all([loadEpisode(params), getCurrentUser()]);
  if (!loaded) return <TitlePreparing />;
  const { id, series, season, episode, previous, next } = loaded;
  const aired = isAired(episode);
  const commentTarget = { kind: "episode", episodeId: episode.id } as const;
  const [watch, comments] = await Promise.all([
    user ? getEpisodeWatch(user.id, episode.id) : null,
    getComments(commentTarget, user?.id ?? null),
  ]);
  const seasonLabel = season.seasonNumber === 0 ? "Özel bölümler" : `Sezon ${season.seasonNumber}`;

  return (
    <article className="mx-auto max-w-4xl space-y-8">
      <nav aria-label="Konum" className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm">
        <Link href={`/series/${id}`} className="hover:text-foreground font-medium">
          {series.name}
        </Link>
        <ChevronRight className="size-3.5" />
        <Link href={`/series/${id}/season/${season.seasonNumber}`} className="hover:text-foreground font-medium">
          {seasonLabel}
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">Bölüm {episode.episodeNumber}</span>
      </nav>

      <header className="space-y-3">
        <p className="text-primary text-sm font-bold tracking-wider">
          {episodeCode(season.seasonNumber, episode.episodeNumber)}
        </p>
        <h1 className="text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl">{episode.name}</h1>
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="size-4" />
            {formatDate(episode.airDate) ?? "Yayın tarihi belli değil"}
          </span>
          {formatRuntime(episode.runtime) && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" />
              {formatRuntime(episode.runtime)}
            </span>
          )}
          <RatingBadge rating={pickRating(episode.imdbRating, episode.sourceRating)} />
          {!aired && (
            <span className="rounded border border-orange-400/30 bg-orange-400/10 px-1.5 py-0.5 text-xs font-semibold text-orange-400">
              Henüz yayınlanmadı
            </span>
          )}
        </div>
      </header>

      <WatchPanel
        target={{ kind: "episode", episodeId: episode.id }}
        aired={aired}
        signedIn={user !== null}
        watch={watch}
        cast={parseCast(series.castMembers)}
      />

      <div className="bg-muted relative aspect-video overflow-hidden rounded-2xl border">
        {episode.stillUrl ? (
          <Image
            src={episode.stillUrl}
            alt={episode.name}
            fill
            priority
            sizes="(min-width: 896px) 896px, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center text-sm font-semibold">
            Bölüm görseli yok
          </div>
        )}
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Özet</h2>
        <p className="text-foreground/85 leading-relaxed">
          {episode.overview ?? "Bu bölüm için açıklama mevcut değil."}
        </p>
      </section>

      <nav aria-label="Bölüm gezinmesi" className="grid gap-3 border-t pt-6 sm:grid-cols-2">
        {previous ? (
          <NeighborLink id={id} target={previous} direction="previous" />
        ) : (
          <span className="hidden sm:block" />
        )}
        {next && <NeighborLink id={id} target={next} direction="next" />}
      </nav>

      <CommentSection
        target={commentTarget}
        comments={comments}
        signedIn={user !== null}
        spoilersRevealed={watch !== null}
      />
    </article>
  );
}

function NeighborLink({ id, target, direction }: { id: string; target: EpisodeRef; direction: "previous" | "next" }) {
  const isNext = direction === "next";
  return (
    <Link
      href={`/series/${id}/season/${target.seasonNumber}/episode/${target.episodeNumber}`}
      className={`bg-card group hover:border-primary/40 flex items-center gap-3 rounded-xl border p-4 transition-colors ${
        isNext ? "sm:flex-row-reverse sm:text-right" : ""
      }`}
    >
      {isNext ? (
        <ChevronRight className="text-muted-foreground group-hover:text-primary size-5 shrink-0" />
      ) : (
        <ChevronLeft className="text-muted-foreground group-hover:text-primary size-5 shrink-0" />
      )}
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs font-semibold">
          {isNext ? "Sonraki bölüm" : "Önceki bölüm"} · {episodeCode(target.seasonNumber, target.episodeNumber)}
        </p>
        <p className="truncate font-semibold">{target.name}</p>
      </div>
    </Link>
  );
}
