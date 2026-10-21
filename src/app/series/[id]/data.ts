import "server-only";
import { cache } from "react";
import { after } from "next/server";
import { notFound } from "next/navigation";
import { lookupSeries, needsImdbSync, refreshSeries, syncImdbRatings, type Series } from "@/lib/catalog";
import { TmdbError } from "@/lib/tmdb";

/**
 * Loads a series by the URL id, deduplicated per request so metadata and page share one lookup.
 * Returns null while a never-opened series is still being fetched (the page shows TitlePreparing).
 * Refreshes from TMDB and IMDb ratings from OMDb run after the response, so they never slow a page down.
 */
export const loadSeries = cache(async (idParam: string): Promise<Series | null> => {
  const tmdbId = Number(idParam);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) notFound();

  let lookup;
  try {
    lookup = await lookupSeries(tmdbId);
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) notFound();
    throw error;
  }

  if (lookup.status === "preparing") {
    after(() => refreshSeries(tmdbId));
    return null;
  }
  const { series, stale } = lookup;
  if (stale) after(() => refreshSeries(tmdbId));
  if (needsImdbSync(series)) after(() => syncImdbRatings(series.id));
  return series;
});
