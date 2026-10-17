import "server-only";
import { cache } from "react";
import { after } from "next/server";
import { notFound } from "next/navigation";
import { getSeries, needsImdbSync, syncImdbRatings } from "@/lib/catalog";
import { TvmazeError } from "@/lib/tvmaze";

/** Loads a series by the URL id, deduplicated per request so metadata and page share one lookup. */
export const loadSeries = cache(async (idParam: string) => {
  const tvmazeId = Number(idParam);
  if (!Number.isInteger(tvmazeId) || tvmazeId <= 0) notFound();

  try {
    const series = await getSeries(tvmazeId);
    // IMDb ratings are fetched after the page is sent, so OMDb never slows the first render
    if (needsImdbSync(series)) after(() => syncImdbRatings(series.id));
    return series;
  } catch (error) {
    if (error instanceof TvmazeError && error.status === 404) notFound();
    throw error;
  }
});
