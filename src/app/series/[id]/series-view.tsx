import Link from "next/link";
import { ListVideo } from "lucide-react";
import { CastList } from "@/components/cast-list";
import { EmptyState } from "@/components/empty-state";
import { EpisodeRow } from "@/components/episode-row";
import { TitleHero } from "@/components/title-hero";
import { WatchProviders } from "@/components/watch-providers";
import { parseCast } from "@/lib/cast";
import { parseProviders } from "@/lib/providers";
import { isAired, sortSeasons } from "@/lib/episodes";
import { formatRuntime, pickRating, statusLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Series } from "@/lib/catalog";
import type { TitleViewerState } from "@/lib/viewer";
import { isSeasonWatched, watchProgress } from "@/lib/watch";
import { SeasonWatchButton } from "@/components/watch/season-watch-button";
import { TitleActions } from "@/components/watch/title-actions";
import { WatchToggle } from "@/components/watch/watch-toggle";

/** Series detail with season tabs; shared by /series/[id] (first season) and /series/[id]/season/[s]. */
export function SeriesView({
  id,
  series,
  seasonNumber,
  viewer,
}: {
  id: string;
  series: Series;
  seasonNumber?: number;
  /** null when signed out */
  viewer: TitleViewerState | null;
}) {
  const signedIn = viewer !== null;
  const watchedIds = viewer?.watchedIds ?? new Set<string>();
  const seasons = visibleSeasons(series);
  const progress = watchProgress(seasons, watchedIds);
  const activeSeason = seasons.find((s) => s.seasonNumber === seasonNumber) ?? seasons[0];
  // Specials (season 0) get their own tab but are left out of the counts
  const regularSeasons = seasons.filter((s) => s.seasonNumber !== 0);
  const totalEpisodes = regularSeasons.reduce((sum, s) => sum + s.episodes.length, 0);
  const firstYear = series.releaseDate?.getFullYear();
  const lastAired = regularSeasons
    .flatMap((s) => s.episodes)
    .filter((ep) => isAired(ep))
    .reduce<Date | null>((latest, ep) => (!latest || ep.airDate! > latest ? ep.airDate : latest), null);
  const yearRange =
    firstYear &&
    (series.status === "Ended" || series.status === "Canceled") &&
    lastAired &&
    lastAired.getFullYear() !== firstYear
      ? `${firstYear}–${lastAired.getFullYear()}`
      : firstYear;

  return (
    <div className="space-y-10">
      <TitleHero
        name={series.name}
        posterUrl={series.posterUrl}
        backdropUrl={series.backdropUrl}
        facts={[
          yearRange,
          statusLabel(series.status) && (
            <span className={cn(series.status === "Returning Series" && "text-emerald-400")}>
              {statusLabel(series.status)}
            </span>
          ),
          `${regularSeasons.length} sezon · ${totalEpisodes} bölüm`,
          formatRuntime(series.runtime) && `~${formatRuntime(series.runtime)}/bölüm`,
        ]}
        rating={pickRating(series.imdbRating, series.sourceRating)}
        genres={series.genres}
        overview={series.overview}
        imdbId={series.imdbId}
      >
        <TitleActions
          titleId={series.id}
          isFavorite={viewer?.isFavorite ?? false}
          inWatchlist={viewer?.inWatchlist ?? false}
          signedIn={signedIn}
        />

        {signedIn && progress.total > 0 && (
          <div className="max-w-md space-y-1.5" aria-label="İzleme ilerlemesi">
            <div className="flex justify-between text-sm">
              <span className="font-semibold">
                {progress.watched}/{progress.total} bölüm izlendi
              </span>
              <span className="text-muted-foreground">%{progress.percent}</span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.watched}
              aria-label={`${progress.total} bölümden ${progress.watched} tanesi izlendi`}
              className="bg-secondary h-2 overflow-hidden rounded-full"
            >
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}
      </TitleHero>

      <WatchProviders providers={parseProviders(series.watchProviders)} />

      <CastList cast={parseCast(series.castMembers)} />

      {/* Seasons */}
      <section className="space-y-5" aria-labelledby="seasons-heading">
        <h2 id="seasons-heading" className="text-xl font-bold">
          Sezonlar
        </h2>

        {!activeSeason ? (
          <EmptyState
            icon={<ListVideo />}
            title="Bölüm bilgisi yok"
            text="Bu dizi için henüz bölüm listesi yayınlanmamış."
          />
        ) : (
          <>
            <nav aria-label="Sezon seçimi" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <div className="flex w-max gap-2 border-b pb-px">
                {seasons.map((s) => {
                  const active = s.id === activeSeason.id;
                  return (
                    <Link
                      key={s.id}
                      href={`/series/${id}/season/${s.seasonNumber}`}
                      scroll={false}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "-mb-px border-b-2 px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors",
                        active
                          ? "border-primary text-foreground"
                          : "text-muted-foreground hover:text-foreground border-transparent",
                      )}
                    >
                      {s.seasonNumber === 0 ? "Özel bölümler" : `Sezon ${s.seasonNumber}`}
                    </Link>
                  );
                })}
              </div>
            </nav>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted-foreground text-sm">
                {activeSeason.name && activeSeason.name !== `Season ${activeSeason.seasonNumber}` && (
                  <span className="text-foreground font-semibold">{activeSeason.name} · </span>
                )}
                {activeSeason.episodes.length} bölüm · {activeSeason.episodes.filter((ep) => isAired(ep)).length}{" "}
                yayınlandı
              </p>
              <SeasonWatchButton
                seasonId={activeSeason.id}
                seasonWatched={isSeasonWatched(activeSeason.episodes, watchedIds)}
                hasAired={activeSeason.episodes.some((ep) => isAired(ep))}
                signedIn={signedIn}
              />
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {activeSeason.episodes.map((ep) => (
                <EpisodeRow
                  key={ep.id}
                  href={`/series/${id}/season/${activeSeason.seasonNumber}/episode/${ep.episodeNumber}`}
                  seasonNumber={activeSeason.seasonNumber}
                  episodeNumber={ep.episodeNumber}
                  name={ep.name}
                  overview={ep.overview}
                  stillUrl={ep.stillUrl}
                  airDate={ep.airDate}
                  runtime={ep.runtime}
                  rating={pickRating(ep.imdbRating, ep.sourceRating)}
                  aired={isAired(ep)}
                  watched={watchedIds.has(ep.id)}
                  watchedAt={viewer?.watchedAt.get(ep.id)}
                  watchCount={viewer?.watchCount.get(ep.id)}
                  action={
                    <WatchToggle
                      episodeId={ep.id}
                      label={`${activeSeason.seasonNumber}. sezon ${ep.episodeNumber}. bölüm`}
                      watched={watchedIds.has(ep.id)}
                      aired={isAired(ep)}
                      signedIn={signedIn}
                    />
                  }
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/** Seasons shown as tabs: in display order, without empty ones. */
export function visibleSeasons(series: Series) {
  return sortSeasons(series.seasons).filter((s) => s.episodes.length > 0);
}
