import Image from "next/image";
import Link from "next/link";
import { WatchToggle } from "@/components/watch/watch-toggle";
import { episodeCode } from "@/lib/format";
import type { EpisodeLink, SeriesProgress } from "@/lib/profile";

/** "İzlemeye devam et": where you left off, the next episode and a one-click "izledim" for it. */
export function ContinueWatchingCard({ series }: { series: SeriesProgress & { next: EpisodeLink } }) {
  const { next, last, progress } = series;
  const episodeHref = (ep: EpisodeLink) =>
    `/series/${series.tmdbId}/season/${ep.seasonNumber}/episode/${ep.episodeNumber}`;

  return (
    <article aria-label={series.name} className="bg-card flex gap-4 rounded-2xl border p-3">
      <Link
        href={`/series/${series.tmdbId}`}
        className="bg-muted relative aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-lg"
      >
        {series.posterUrl && (
          <Image src={series.posterUrl} alt={series.name} fill sizes="80px" className="object-cover" />
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Link href={`/series/${series.tmdbId}`} className="hover:text-primary truncate font-bold">
          {series.name}
        </Link>
        {last && (
          <p className="text-muted-foreground truncate text-xs">
            Son izlenen: {episodeCode(last.seasonNumber, last.episodeNumber)} · {last.name}
          </p>
        )}
        <div className="mt-auto flex items-center gap-3">
          <Link href={episodeHref(next)} className="group min-w-0 flex-1">
            <span className="text-primary block text-xs font-bold">
              Sıradaki · {episodeCode(next.seasonNumber, next.episodeNumber)}
            </span>
            <span className="group-hover:text-primary block truncate text-sm font-semibold">{next.name}</span>
          </Link>
          <WatchToggle
            episodeId={next.episodeId}
            label={`${series.name} ${next.seasonNumber}. sezon ${next.episodeNumber}. bölüm`}
            watched={false}
            aired
            signedIn
          />
        </div>
        <div
          className="bg-secondary h-1 overflow-hidden rounded-full"
          aria-label={`${progress.total} bölümden ${progress.watched} tanesi izlendi`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.watched}
        >
          <div className="bg-primary h-full" style={{ width: `${progress.percent}%` }} />
        </div>
      </div>
    </article>
  );
}
