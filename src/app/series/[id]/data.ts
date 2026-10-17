import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getSeries } from "@/lib/catalog";
import { TvmazeError } from "@/lib/tvmaze";

/** Loads a series by the URL id, deduplicated per request so metadata and page share one lookup. */
export const loadSeries = cache(async (idParam: string) => {
  const tvmazeId = Number(idParam);
  if (!Number.isInteger(tvmazeId) || tvmazeId <= 0) notFound();

  try {
    return await getSeries(tvmazeId);
  } catch (error) {
    if (error instanceof TvmazeError && error.status === 404) notFound();
    throw error;
  }
});
