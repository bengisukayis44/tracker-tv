import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadSeries } from "./data";
import { SeriesSkeleton } from "./series-skeleton";
import { SeriesView } from "./series-view";

/*
 * Loading state: a Suspense boundary inside the page instead of a route-level loading.tsx. With Next.js 15.5,
 * a loading.tsx at this level made some client-side navigations within the same series (season tabs,
 * breadcrumb back from an episode) never commit.
 */
type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sezon?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const series = await loadSeries((await params).id);
  return { title: series.name, description: series.overview ?? undefined };
}

export default async function SeriesPage({ params, searchParams }: Props) {
  const { id } = await params;
  // Old links used ?sezon=N; seasons now have their own URL (see season/[s]/page.tsx)
  const { sezon } = await searchParams;
  if (sezon && /^\d+$/.test(sezon)) redirect(`/series/${id}/season/${sezon}`);

  return (
    <Suspense fallback={<SeriesSkeleton />}>
      <SeriesContent id={id} />
    </Suspense>
  );
}

async function SeriesContent({ id }: { id: string }) {
  return <SeriesView id={id} series={await loadSeries(id)} />;
}
