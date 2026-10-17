import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadSeries } from "../../data";
import { SeriesSkeleton } from "../../series-skeleton";
import { SeriesView, visibleSeasons } from "../../series-view";

/*
 * The season is part of the path rather than a ?sezon= query parameter: with Next.js 15.5 a client-side
 * navigation that only changes the search params of the series page never commits, so the tabs did nothing.
 */
type Props = { params: Promise<{ id: string; s: string }> };

async function loadSeason(id: string, s: string) {
  const series = await loadSeries(id);
  const seasonNumber = Number(s);
  if (!/^\d+$/.test(s) || !visibleSeasons(series).some((season) => season.seasonNumber === seasonNumber)) notFound();
  return { series, seasonNumber };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, s } = await params;
  const { series, seasonNumber } = await loadSeason(id, s);
  const label = seasonNumber === 0 ? "Özel bölümler" : `Sezon ${seasonNumber}`;
  return { title: `${series.name} · ${label}`, description: series.overview ?? undefined };
}

export default async function SeasonPage({ params }: Props) {
  const { id, s } = await params;
  return (
    <Suspense fallback={<SeriesSkeleton />}>
      <SeasonContent id={id} s={s} />
    </Suspense>
  );
}

async function SeasonContent({ id, s }: { id: string; s: string }) {
  const { series, seasonNumber } = await loadSeason(id, s);
  return <SeriesView id={id} series={series} seasonNumber={seasonNumber} />;
}
