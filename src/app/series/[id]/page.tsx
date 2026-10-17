import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getTitleViewerState } from "@/lib/viewer";
import { loadSeries } from "./data";
import { SeriesPreparing } from "./series-preparing";
import { SeriesView } from "./series-view";

/*
 * No loading.tsx or Suspense boundary on the series pages: with Next.js 15.5 either one stopped client-side
 * updates of this page from showing (season tabs, the breadcrumb back from an episode, and the refreshed
 * progress after marking an episode watched). The page is rendered in one piece instead.
 */
type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sezon?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const series = await loadSeries((await params).id);
  if (!series) return { title: "Dizi hazırlanıyor" };
  return { title: series.name, description: series.overview ?? undefined };
}

export default async function SeriesPage({ params, searchParams }: Props) {
  const { id } = await params;
  // Old links used ?sezon=N; seasons now have their own URL (see season/[s]/page.tsx)
  const { sezon } = await searchParams;
  if (sezon && /^\d+$/.test(sezon)) redirect(`/series/${id}/season/${sezon}`);

  const [series, user] = await Promise.all([loadSeries(id), getCurrentUser()]);
  if (!series) return <SeriesPreparing />;
  const viewer = user ? await getTitleViewerState(user.id, series.id) : null;
  return <SeriesView id={id} series={series} viewer={viewer} />;
}
