import { PosterCard } from "@/components/poster-card";
import type { SeriesProgress } from "@/lib/profile";

/** A watched series with its progress bar ("5/12 bölüm"). */
export function SeriesProgressCard({ series }: { series: SeriesProgress }) {
  const { watched, total, percent } = series.progress;
  return (
    <PosterCard
      href={`/series/${series.tmdbId}`}
      title={series.name}
      posterUrl={series.posterUrl}
      subtitle={`${watched}/${total} bölüm · %${percent}`}
    >
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={watched}
        aria-label={`${series.name}: ${total} bölümden ${watched} tanesi izlendi`}
        className="bg-secondary mt-2 h-1.5 overflow-hidden rounded-full"
      >
        <div
          className={percent === 100 ? "h-full bg-emerald-500" : "bg-primary h-full"}
          style={{ width: `${percent}%` }}
        />
      </div>
    </PosterCard>
  );
}
