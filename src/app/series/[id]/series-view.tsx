import Image from "next/image";
import Link from "next/link";
import { ExternalLink, ListVideo } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { EpisodeRow } from "@/components/episode-row";
import { RatingBadge } from "@/components/rating-badge";
import { Badge } from "@/components/ui/badge";
import { isAired, sortSeasons } from "@/lib/episodes";
import { formatRuntime, genreLabel, pickRating, statusLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Series } from "@/lib/catalog";

/** Series detail with season tabs; shared by /series/[id] (first season) and /series/[id]/season/[s]. */
export function SeriesView({ id, series, seasonNumber }: { id: string; series: Series; seasonNumber?: number }) {
  const seasons = visibleSeasons(series);
  const activeSeason = seasons.find((s) => s.seasonNumber === seasonNumber) ?? seasons[0];
  const genres = series.genres;
  const totalEpisodes = seasons.reduce((sum, s) => sum + s.episodes.length, 0);
  const firstYear = series.releaseDate?.getFullYear();
  const lastAired = seasons
    .flatMap((s) => s.episodes)
    .filter((ep) => isAired(ep))
    .reduce<Date | null>((latest, ep) => (!latest || ep.airDate! > latest ? ep.airDate : latest), null);
  const yearRange =
    firstYear && series.status === "Ended" && lastAired && lastAired.getFullYear() !== firstYear
      ? `${firstYear}–${lastAired.getFullYear()}`
      : firstYear;

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="bg-card relative -mx-4 overflow-hidden border-y sm:mx-0 sm:rounded-3xl sm:border">
        {series.backdropUrl && (
          <>
            <Image src={series.backdropUrl} alt="" fill priority sizes="100vw" className="object-cover opacity-30" />
            <div className="from-card via-card/85 to-card/40 absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r" />
          </>
        )}
        <div className="relative flex flex-col gap-6 p-5 sm:p-8 md:flex-row md:gap-8">
          <div className="bg-muted relative aspect-[2/3] w-36 shrink-0 overflow-hidden rounded-xl border shadow-2xl sm:w-48 md:w-56">
            {series.posterUrl ? (
              <Image src={series.posterUrl} alt={series.name} fill priority sizes="224px" className="object-cover" />
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center text-sm font-semibold">
                Poster yok
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl">{series.name}</h1>
              <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                {yearRange && <span>{yearRange}</span>}
                {statusLabel(series.status) && (
                  <span className={cn(series.status === "Running" && "text-emerald-400")}>
                    {statusLabel(series.status)}
                  </span>
                )}
                <span>
                  {seasons.length} sezon · {totalEpisodes} bölüm
                </span>
                {formatRuntime(series.runtime) && <span>~{formatRuntime(series.runtime)}/bölüm</span>}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <RatingBadge rating={pickRating(series.imdbRating, series.sourceRating)} />
              {genres.map((g) => (
                <Badge key={g} variant="secondary">
                  {genreLabel(g)}
                </Badge>
              ))}
            </div>

            {series.overview && <p className="text-foreground/85 max-w-3xl leading-relaxed">{series.overview}</p>}

            {series.imdbId && (
              <a
                href={`https://www.imdb.com/title/${series.imdbId}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm font-medium"
              >
                IMDb&apos;de görüntüle
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        </div>
      </section>

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

            <p className="text-muted-foreground text-sm">
              {activeSeason.name && activeSeason.name !== `Season ${activeSeason.seasonNumber}` && (
                <span className="text-foreground font-semibold">{activeSeason.name} · </span>
              )}
              {activeSeason.episodes.length} bölüm · {activeSeason.episodes.filter((ep) => isAired(ep)).length}{" "}
              yayınlandı
            </p>

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
