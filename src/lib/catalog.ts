import "server-only";
import { randomUUID } from "node:crypto";
import { omdb, OmdbError, isOmdbEnabled } from "@/lib/omdb";
import { prisma } from "@/lib/prisma";
import { pickBackdrop, stripHtml, tvmaze, TvmazeError, type TvmazeShow, type TvmazeShowWithEmbeds } from "@/lib/tvmaze";

/**
 * Content catalog backed by the database (PROJE_PLANI.md §2 "Önbellekleme").
 * The first request for a series fetches it from TVmaze and stores Title/Season/Episode rows;
 * later requests are served from the database until the data is older than its refresh interval.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
// Airing shows get new episodes weekly, so they refresh more often than finished ones
const REFRESH_INTERVAL_RUNNING_MS = 1 * DAY_MS;
const REFRESH_INTERVAL_DEFAULT_MS = 7 * DAY_MS;
const EPISODE_BATCH_SIZE = 500;
// OMDb free keys allow 1,000 requests/day; IMDb ratings change slowly
const IMDB_REFRESH_INTERVAL_MS = 7 * DAY_MS;
const OMDB_CONCURRENCY = 4;

export type SearchResult = {
  tvmazeId: number;
  type: "SERIES";
  name: string;
  posterUrl: string | null;
  year: number | null;
  status: string | null;
  sourceRating: number | null;
  imdbRating: number | null; // only known for titles already in the cache
  genres: string[];
  overview: string | null;
};

function toSearchResult(show: TvmazeShow): SearchResult {
  return {
    tvmazeId: show.id,
    type: "SERIES",
    name: show.name,
    posterUrl: show.image?.medium ?? null,
    year: show.premiered ? Number(show.premiered.slice(0, 4)) : null,
    status: show.status ?? null,
    sourceRating: show.rating?.average ?? null,
    imdbRating: null,
    genres: show.genres ?? [],
    overview: stripHtml(show.summary),
  };
}

// ---------- Search ----------

// Search results are stored in the database (server memory is not shared between Vercel instances)
const SEARCH_CACHE_TTL_MS = 1 * DAY_MS;
// TVmaze can take 30-90 s for a query it has not cached yet; the page does not wait that long
const LIVE_SEARCH_TIMEOUT_MS = 4_000;
const BACKGROUND_SEARCH_TIMEOUT_MS = 60_000;
const LOCAL_SEARCH_LIMIT = 20;

export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
}

export type SearchOutcome = {
  results: SearchResult[];
  /** True when TVmaze did not answer in time and the results come from what is already stored */
  partial: boolean;
};

async function fetchAndStoreSearch(query: string, timeoutMs: number, retries: number): Promise<SearchResult[]> {
  const results = (await tvmaze.searchShows(query, { timeoutMs, retries })).map(toSearchResult);
  const key = normalizeQuery(query);
  const data = { results: results as unknown as object[], fetchedAt: new Date() };
  await prisma.searchCache.upsert({ where: { query: key }, create: { query: key, ...data }, update: data });
  return results;
}

/** Series already in our database whose name contains the query (fallback while TVmaze is slow). */
async function searchStoredTitles(query: string): Promise<SearchResult[]> {
  const titles = await prisma.title.findMany({
    where: { type: "SERIES", tvmazeId: { not: null }, name: { contains: query.trim(), mode: "insensitive" } },
    orderBy: [{ sourceRating: { sort: "desc", nulls: "last" } }, { name: "asc" }],
    take: LOCAL_SEARCH_LIMIT,
  });
  return titles.map((t) => ({
    tvmazeId: t.tvmazeId!,
    type: "SERIES",
    name: t.name,
    posterUrl: t.posterUrl,
    year: t.releaseDate?.getFullYear() ?? null,
    status: t.status,
    sourceRating: t.sourceRating,
    imdbRating: t.imdbRating,
    genres: t.genres,
    overview: t.overview,
  }));
}

async function withImdbRatings(results: SearchResult[]): Promise<SearchResult[]> {
  if (results.length === 0) return results;
  const cached = await prisma.title.findMany({
    where: { tvmazeId: { in: results.map((r) => r.tvmazeId) }, imdbRating: { not: null } },
    select: { tvmazeId: true, imdbRating: true },
  });
  const imdbByTvmazeId = new Map(cached.map((t) => [t.tvmazeId, t.imdbRating]));
  return results.map((r) => ({ ...r, imdbRating: imdbByTvmazeId.get(r.tvmazeId) ?? r.imdbRating ?? null }));
}

/**
 * Searches series: a fresh stored result is returned at once; otherwise TVmaze is asked with a short timeout.
 * If TVmaze is slow or down, stored results (an older cached search, or matching stored series) are returned
 * with `partial: true` — the caller should then run `refreshSearchCache` in the background.
 */
export async function searchTitles(query: string): Promise<SearchOutcome> {
  const key = normalizeQuery(query);
  const cached = await prisma.searchCache.findUnique({ where: { query: key } });
  if (cached && Date.now() - cached.fetchedAt.getTime() < SEARCH_CACHE_TTL_MS) {
    return { results: await withImdbRatings(cached.results as unknown as SearchResult[]), partial: false };
  }

  try {
    return {
      results: await withImdbRatings(await fetchAndStoreSearch(query, LIVE_SEARCH_TIMEOUT_MS, 0)),
      partial: false,
    };
  } catch (error) {
    console.warn(`TVmaze araması yetişmedi ("${key}"), kayıtlı sonuçlar gösteriliyor:`, error);
    const fallback = cached ? (cached.results as unknown as SearchResult[]) : await searchStoredTitles(query);
    return { results: await withImdbRatings(fallback), partial: true };
  }
}

/** Completes a search that timed out, so the next visit gets full results. Never throws. */
export async function refreshSearchCache(query: string): Promise<void> {
  try {
    await fetchAndStoreSearch(query, BACKGROUND_SEARCH_TIMEOUT_MS, 1);
  } catch (error) {
    console.error(`Arka planda arama tamamlanamadı ("${normalizeQuery(query)}"):`, error);
  }
}

export function isStale(lastSyncedAt: Date | null, status: string | null, now = Date.now()) {
  if (!lastSyncedAt) return true;
  const interval = status === "Ended" ? REFRESH_INTERVAL_DEFAULT_MS : REFRESH_INTERVAL_RUNNING_MS;
  return now - lastSyncedAt.getTime() > interval;
}

async function saveSeries(show: TvmazeShowWithEmbeds) {
  const titleData = {
    imdbId: show.externals?.imdb ?? null,
    name: show.name,
    overview: stripHtml(show.summary),
    posterUrl: show.image?.original ?? show.image?.medium ?? null,
    backdropUrl: pickBackdrop(show._embedded?.images),
    sourceRating: show.rating?.average ?? null,
    runtime: show.averageRuntime ?? show.runtime ?? null,
    releaseDate: show.premiered ? new Date(show.premiered) : null,
    status: show.status ?? null,
    genres: show.genres ?? [],
  };

  // lastSyncedAt is only set once seasons and episodes are stored, so a failed sync is retried next time
  const title = await prisma.title.upsert({
    where: { tvmazeId: show.id },
    create: { tvmazeId: show.id, type: "SERIES", ...titleData },
    update: titleData,
  });

  // Specials have no episode number and do not fit the (season, episodeNumber) key, so they are skipped
  const episodes = (show._embedded?.episodes ?? []).filter((ep) => ep.number != null);
  const seasonInfo = new Map((show._embedded?.seasons ?? []).map((s) => [s.number, s]));
  const seasonRows = [...new Set(episodes.map((ep) => ep.season))].map((seasonNumber) => {
    const info = seasonInfo.get(seasonNumber);
    return {
      id: randomUUID(),
      seasonNumber,
      name: info?.name || null,
      posterUrl: info?.image?.original ?? info?.image?.medium ?? null,
    };
  });

  // Bulk upserts: one statement per batch instead of one round trip per row (long shows have 800+ episodes)
  const seasons = await prisma.$queryRaw<{ id: string; seasonNumber: number }[]>`
    INSERT INTO "Season" ("id", "titleId", "seasonNumber", "name", "posterUrl")
    SELECT x."id", ${title.id}, x."seasonNumber", x."name", x."posterUrl"
    FROM jsonb_to_recordset(${JSON.stringify(seasonRows)}::jsonb)
      AS x("id" text, "seasonNumber" int, "name" text, "posterUrl" text)
    ON CONFLICT ("titleId", "seasonNumber") DO UPDATE
      SET "name" = EXCLUDED."name", "posterUrl" = EXCLUDED."posterUrl"
    RETURNING "id", "seasonNumber"`;
  const seasonIdByNumber = new Map(seasons.map((s) => [s.seasonNumber, s.id]));

  const episodeRows = episodes.map((ep) => ({
    id: randomUUID(),
    tvmazeId: ep.id,
    seasonId: seasonIdByNumber.get(ep.season)!,
    episodeNumber: ep.number!,
    name: ep.name,
    overview: stripHtml(ep.summary),
    runtime: ep.runtime,
    sourceRating: ep.rating?.average ?? null,
    // Stored as UTC in a timestamp-without-time-zone column, matching Prisma's convention
    airDate: ep.airstamp ? new Date(ep.airstamp).toISOString() : null,
    stillUrl: ep.image?.original ?? ep.image?.medium ?? null,
  }));

  for (let i = 0; i < episodeRows.length; i += EPISODE_BATCH_SIZE) {
    const batch = episodeRows.slice(i, i + EPISODE_BATCH_SIZE);
    await prisma.$executeRaw`
      INSERT INTO "Episode"
        ("id", "tvmazeId", "seasonId", "episodeNumber", "name", "overview", "runtime", "sourceRating", "airDate", "stillUrl")
      SELECT x."id", x."tvmazeId", x."seasonId", x."episodeNumber", x."name", x."overview", x."runtime",
             x."sourceRating", x."airDate", x."stillUrl"
      FROM jsonb_to_recordset(${JSON.stringify(batch)}::jsonb) AS x(
        "id" text, "tvmazeId" int, "seasonId" text, "episodeNumber" int, "name" text, "overview" text,
        "runtime" int, "sourceRating" double precision, "airDate" timestamp(3), "stillUrl" text)
      ON CONFLICT ("tvmazeId") DO UPDATE SET
        "seasonId" = EXCLUDED."seasonId",
        "episodeNumber" = EXCLUDED."episodeNumber",
        "name" = EXCLUDED."name",
        "overview" = EXCLUDED."overview",
        "runtime" = EXCLUDED."runtime",
        "sourceRating" = EXCLUDED."sourceRating",
        "airDate" = EXCLUDED."airDate",
        "stillUrl" = EXCLUDED."stillUrl"`;
  }

  await prisma.title.update({ where: { id: title.id }, data: { lastSyncedAt: new Date() } });
}

const seriesInclude = {
  seasons: {
    orderBy: { seasonNumber: "asc" },
    include: { episodes: { orderBy: { episodeNumber: "asc" } } },
  },
} as const;

// A first visit waits this long for TVmaze; slower answers are finished in the background
const FIRST_LOAD_TIMEOUT_MS = 10_000;
const BACKGROUND_LOAD_TIMEOUT_MS = 60_000;

function findStoredSeries(tvmazeId: number) {
  return prisma.title.findUnique({ where: { tvmazeId }, include: seriesInclude });
}

export type Series = NonNullable<Awaited<ReturnType<typeof findStoredSeries>>>;

export type SeriesLookup =
  /** `stale`: shown as is; the caller should run refreshSeries in the background */
  | { status: "ready"; series: Series; stale: boolean }
  /** Not stored yet and TVmaze did not answer in time; refreshSeries will finish it */
  | { status: "preparing" };

/**
 * Stale-while-revalidate: a stored series is always returned at once (flagged when it is due a refresh), so
 * visitors never wait for TVmaze. Only a series nobody has opened yet is fetched while the visitor waits,
 * for at most FIRST_LOAD_TIMEOUT_MS. Unknown TVmaze ids throw a TvmazeError with status 404.
 */
export async function lookupSeries(tvmazeId: number): Promise<SeriesLookup> {
  const stored = await findStoredSeries(tvmazeId);
  if (stored) return { status: "ready", series: stored, stale: isStale(stored.lastSyncedAt, stored.status) };

  try {
    await saveSeries(await tvmaze.getShowWithEpisodes(tvmazeId, { timeoutMs: FIRST_LOAD_TIMEOUT_MS, retries: 0 }));
  } catch (error) {
    if (error instanceof TvmazeError && error.status === 404) throw error;
    console.warn(`TVmaze dizi isteği yetişmedi (tvmazeId=${tvmazeId}), arka planda devam edilecek:`, error);
    return { status: "preparing" };
  }
  return { status: "ready", series: (await findStoredSeries(tvmazeId))!, stale: false };
}

const seriesRefreshInFlight = new Set<number>();

/** Fetches a series from TVmaze (waiting up to a minute) and stores it. Meant for after(); never throws. */
export async function refreshSeries(tvmazeId: number): Promise<void> {
  if (seriesRefreshInFlight.has(tvmazeId)) return;
  seriesRefreshInFlight.add(tvmazeId);
  try {
    await saveSeries(await tvmaze.getShowWithEpisodes(tvmazeId, { timeoutMs: BACKGROUND_LOAD_TIMEOUT_MS, retries: 1 }));
  } catch (error) {
    console.error(`Dizi arka planda güncellenemedi (tvmazeId=${tvmazeId}):`, error);
  } finally {
    seriesRefreshInFlight.delete(tvmazeId);
  }
}

// ---------- IMDb ratings (OMDb) ----------

export function needsImdbSync(title: { imdbId: string | null; imdbSyncedAt: Date | null }, now = Date.now()): boolean {
  if (!title.imdbId || !isOmdbEnabled()) return false;
  return !title.imdbSyncedAt || now - title.imdbSyncedAt.getTime() > IMDB_REFRESH_INTERVAL_MS;
}

/** Runs async tasks with at most `limit` in flight. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

const imdbSyncInFlight = new Set<string>();

/**
 * Fetches the series and per-episode IMDb ratings from OMDb (1 + number of seasons requests) and stores them.
 * Meant to run after the response is sent (see scheduleImdbSync). Failures are logged, not thrown, and leave
 * imdbSyncedAt untouched so the next visit retries.
 */
export async function syncImdbRatings(titleId: string): Promise<void> {
  if (imdbSyncInFlight.has(titleId)) return;
  imdbSyncInFlight.add(titleId);
  try {
    const title = await prisma.title.findUnique({
      where: { id: titleId },
      select: { imdbId: true, imdbSyncedAt: true, seasons: { select: { seasonNumber: true } } },
    });
    if (!title?.imdbId || !needsImdbSync(title)) return;
    const imdbId = title.imdbId;

    const titleRating = await omdb.getTitleRating(imdbId);
    const seasonNumbers = title.seasons.map((s) => s.seasonNumber).filter((n) => n > 0);
    const perSeason = await mapWithConcurrency(seasonNumbers, OMDB_CONCURRENCY, async (season) =>
      (await omdb.getSeasonRatings(imdbId, season)).map((ep) => ({ season, ...ep })),
    );
    const rows = perSeason.flat();

    if (rows.length > 0) {
      await prisma.$executeRaw`
        UPDATE "Episode" AS e
        SET "imdbId" = x."imdbId", "imdbRating" = x."rating"
        FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
          AS x("season" int, "episode" int, "imdbId" text, "rating" double precision),
          "Season" AS s
        WHERE e."seasonId" = s."id"
          AND s."titleId" = ${titleId}
          AND s."seasonNumber" = x."season"
          AND e."episodeNumber" = x."episode"`;
    }
    await prisma.title.update({ where: { id: titleId }, data: { imdbRating: titleRating, imdbSyncedAt: new Date() } });
  } catch (error) {
    if (error instanceof OmdbError && error.kind === "limit") {
      console.warn("OMDb günlük istek limiti doldu; IMDb puanları yarın güncellenecek.");
    } else {
      console.error(`IMDb puanları güncellenemedi (titleId=${titleId}):`, error);
    }
  } finally {
    imdbSyncInFlight.delete(titleId);
  }
}
