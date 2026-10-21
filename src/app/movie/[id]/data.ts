import "server-only";
import { cache } from "react";
import { after } from "next/server";
import { notFound } from "next/navigation";
import { lookupMovie, needsImdbSync, refreshMovie, syncImdbRatings, type Movie } from "@/lib/catalog";
import { TmdbError } from "@/lib/tmdb";

/**
 * Loads a movie by the URL id (TMDB movie id), deduplicated per request.
 * Returns null while a never-opened movie is still being fetched (the page shows TitlePreparing).
 * Refreshes and IMDb ratings run after the response.
 */
export const loadMovie = cache(async (idParam: string): Promise<Movie | null> => {
  const tmdbId = Number(idParam);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) notFound();

  let lookup;
  try {
    lookup = await lookupMovie(tmdbId);
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) notFound();
    throw error;
  }

  if (lookup.status === "preparing") {
    after(() => refreshMovie(tmdbId));
    return null;
  }
  const { movie, stale } = lookup;
  if (stale) after(() => refreshMovie(tmdbId));
  if (needsImdbSync(movie)) after(() => syncImdbRatings(movie.id));
  return movie;
});
