import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getTitleViewerState } from "@/lib/viewer";
import { loadSeries } from "../../data";
import { TitlePreparing } from "@/components/title-preparing";
import { SeriesView, visibleSeasons } from "../../series-view";

/*
 * The season is part of the path rather than a ?sezon= query parameter: with Next.js 15.5 a client-side
 * navigation that only changes the search params of the series page never commits, so the tabs did nothing.
 * (See ../../page.tsx for why there is no loading state here.)
 */
type Props = { params: Promise<{ id: string; s: string }> };

async function loadSeason(id: string, s: string) {
  const series = await loadSeries(id);
  if (!series) return null;
  const seasonNumber = Number(s);
  if (!/^\d+$/.test(s) || !visibleSeasons(series).some((season) => season.seasonNumber === seasonNumber)) notFound();
  return { series, seasonNumber };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, s } = await params;
  const season = await loadSeason(id, s);
  if (!season) return { title: "Dizi hazırlanıyor" };
  const { series, seasonNumber } = season;
  const label = seasonNumber === 0 ? "Özel bölümler" : `Sezon ${seasonNumber}`;
  return { title: `${series.name} · ${label}`, description: series.overview ?? undefined };
}

export default async function SeasonPage({ params }: Props) {
  const { id, s } = await params;
  const [season, user] = await Promise.all([loadSeason(id, s), getCurrentUser()]);
  if (!season) return <TitlePreparing />;
  const { series, seasonNumber } = season;
  const viewer = user ? await getTitleViewerState(user.id, series.id) : null;
  return <SeriesView id={id} series={series} seasonNumber={seasonNumber} viewer={viewer} />;
}
