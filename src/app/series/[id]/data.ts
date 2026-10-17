import "server-only";
import { cache } from "react";
import { after } from "next/server";
import { notFound } from "next/navigation";
import { lookupSeries, needsImdbSync, refreshSeries, syncImdbRatings, type Series } from "@/lib/catalog";
import { TvmazeError } from "@/lib/tvmaze";

/**
 * Loads a series by the URL id, deduplicated per request so metadata and page share one lookup.
 * Returns null while a never-opened series is still being fetched (the page shows SeriesPreparing).
 * Refreshes from TVmaze and IMDb ratings from OMDb run after the response, so they never slow a page down.
 */
export const loadSeries = cache(async (idParam: string): Promise<Series | null> => {
  const tvmazeId = Number(idParam);
  if (!Number.isInteger(tvmazeId) || tvmazeId <= 0) notFound();

  let lookup;
  try {
    lookup = await lookupSeries(tvmazeId);
  } catch (error) {
    if (error instanceof TvmazeError && error.status === 404) notFound();
    throw error;
  }

  if (lookup.status === "preparing") {
    after(() => refreshSeries(tvmazeId));
    return null;
  }
  const { series, stale } = lookup;
  if (stale) after(() => refreshSeries(tvmazeId));
  if (needsImdbSync(series)) after(() => syncImdbRatings(series.id));
  return series;
});
