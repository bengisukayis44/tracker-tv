import "server-only";
import { randomUUID } from "node:crypto";
import { unstable_cache } from "next/cache";
import { castFromAggregate, castFromCredits } from "@/lib/cast";
import { providersFromTmdb } from "@/lib/providers";
import { omdb, OmdbError, isOmdbEnabled } from "@/lib/omdb";
import { prisma } from "@/lib/prisma";
import {
  cleanText,
  tmdb,
  TmdbError,
  tmdbImage,
  tmdbRating,
  type TmdbMovieDetails,
  type TmdbMovieSearchItem,
  type TmdbTvSearchItem,
  type TmdbTvWithSeasons,
} from "@/lib/tmdb";

/**
 * Content catalog backed by the database (PROJE_PLANI.md §2 "Önbellekleme").
 * The first request for a series fetches it from TMDB and stores Title/Season/Episode rows;
 * later requests are served from the database and refreshed in the background when they get old.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
// Airing shows get new episodes weekly, so they refresh more often than finished ones
const REFRESH_INTERVAL_RUNNING_MS = 1 * DAY_MS;
const REFRESH_INTERVAL_DEFAULT_MS = 7 * DAY_MS;
// Finished series and released movies change rarely
const FINISHED_STATUSES = new Set(["Ended", "Canceled", "Released"]);
const EPISODE_BATCH_SIZE = 500;
// OMDb free keys allow 1,000 requests/day; IMDb ratings change slowly
const IMDB_REFRESH_INTERVAL_MS = 7 * DAY_MS;
const OMDB_CONCURRENCY = 4;

export type TitleKind = "SERIES" | "MOVIE";

export type SearchResult = {
  tmdbId: number;
  type: TitleKind;
  name: string;
  posterUrl: string | null;
  year: number | null;
  status: string | null;
  sourceRating: number | null;
  imdbRating: number | null; // only known for titles already in the cache
  genres: string[];
  overview: string | null;
};

/** Page of a title: /series/[tmdbId] or /movie/[tmdbId] */
export function titleHref(type: TitleKind, tmdbId: number) {
  return type === "MOVIE" ? `/movie/${tmdbId}` : `/series/${tmdbId}`;
}

function genreNames(ids: number[], genres: Map<number, string>) {
  return ids.map((id) => genres.get(id)).filter((g): g is string => Boolean(g));
}

export function movieSearchResult(item: TmdbMovieSearchItem, genres: Map<number, string>): SearchResult {
  return {
    tmdbId: item.id,
    type: "MOVIE",
    name: cleanText(item.title) ?? item.title,
    posterUrl: tmdbImage(item.poster_path, "w342"),
    year: item.release_date ? Number(item.release_date.slice(0, 4)) : null,
    status: null,
    sourceRating: tmdbRating(item.vote_average, item.vote_count),
    imdbRating: null,
    genres: genreNames(item.genre_ids, genres),
    overview: cleanText(item.overview),
  };
}

export function toSearchResult(item: TmdbTvSearchItem, genres: Map<number, string>): SearchResult {
  return {
    tmdbId: item.id,
    type: "SERIES",
    name: cleanText(item.name) ?? item.name,
    posterUrl: tmdbImage(item.poster_path, "w342"),
    year: item.first_air_date ? Number(item.first_air_date.slice(0, 4)) : null,
    status: null, // not part of TMDB search results
    sourceRating: tmdbRating(item.vote_average, item.vote_count),
    imdbRating: null,
    genres: genreNames(item.genre_ids, genres),
    overview: cleanText(item.overview),
  };
}

// ---------- Search ----------

// Search results are stored in the database (server memory is not shared between Vercel instances)
const SEARCH_CACHE_TTL_MS = 1 * DAY_MS;
// The page never waits long for the data source; slow searches are finished in the background
const LIVE_SEARCH_TIMEOUT_MS = 4_000;
const BACKGROUND_SEARCH_TIMEOUT_MS = 60_000;
const LOCAL_SEARCH_LIMIT = 20;

export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
}

/** "all": series and movies together, in TMDB's relevance order */
export type SearchKind = "all" | "series" | "movie";

export type SearchOutcome = {
  results: SearchResult[];
  /** True when the data source did not answer in time and the results come from what is already stored */
  partial: boolean;
};

function searchCacheKey(query: string, kind: SearchKind) {
  return `${kind}:${normalizeQuery(query)}`;
}

async function fetchSearch(query: string, kind: SearchKind, timeoutMs: number, retries: number) {
  const options = { timeoutMs, retries };
  // Genre names are a nice-to-have: search still works without them
  const noGenres = () => new Map<number, string>();
  const tvGenres = () => tmdb.tvGenres(options).catch(noGenres);
  const movieGenres = () => tmdb.movieGenres(options).catch(noGenres);

  if (kind === "series") {
    const [items, genres] = await Promise.all([tmdb.searchTv(query, options), tvGenres()]);
    return items.map((item) => toSearchResult(item, genres));
  }
  if (kind === "movie") {
    const [items, genres] = await Promise.all([tmdb.searchMovies(query, options), movieGenres()]);
    return items.map((item) => movieSearchResult(item, genres));
  }
  const [items, tvG, movieG] = await Promise.all([tmdb.searchMulti(query, options), tvGenres(), movieGenres()]);
  return items.map((item) =>
    item.media_type === "movie" ? movieSearchResult(item, movieG) : toSearchResult(item, tvG),
  );
}

async function fetchAndStoreSearch(
  query: string,
  kind: SearchKind,
  timeoutMs: number,
  retries: number,
): Promise<SearchResult[]> {
  const results = await fetchSearch(query, kind, timeoutMs, retries);
  const key = searchCacheKey(query, kind);
  const data = { results: results as unknown as object[], fetchedAt: new Date() };
  await prisma.searchCache.upsert({ where: { query: key }, create: { query: key, ...data }, update: data });
  return results;
}

/** Titles already in our database whose name contains the query (fallback while the source is slow). */
async function searchStoredTitles(query: string, kind: SearchKind): Promise<SearchResult[]> {
  const types: TitleKind[] = kind === "series" ? ["SERIES"] : kind === "movie" ? ["MOVIE"] : ["SERIES", "MOVIE"];
  const titles = await prisma.title.findMany({
    where: { type: { in: types }, tmdbId: { not: null }, name: { contains: query.trim(), mode: "insensitive" } },
    orderBy: [{ sourceRating: { sort: "desc", nulls: "last" } }, { name: "asc" }],
    take: LOCAL_SEARCH_LIMIT,
  });
  return titles.map((t) => ({
    tmdbId: t.tmdbId!,
    type: t.type,
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
    where: { tmdbId: { in: results.map((r) => r.tmdbId) }, imdbRating: { not: null } },
    select: { type: true, tmdbId: true, imdbRating: true },
  });
  // Series and movies have separate TMDB id spaces
  const imdbByKey = new Map(cached.map((t) => [`${t.type}:${t.tmdbId}`, t.imdbRating]));
  return results.map((r) => ({ ...r, imdbRating: imdbByKey.get(`${r.type}:${r.tmdbId}`) ?? r.imdbRating ?? null }));
}

/**
 * Searches series and/or movies: a fresh stored result is returned at once; otherwise TMDB is asked with a short timeout.
 * If TMDB is slow or down, stored results (an older cached search, or matching stored series) are returned
 * with `partial: true` — the caller should then run `refreshSearchCache` in the background.
 */
export async function searchTitles(query: string, kind: SearchKind = "all"): Promise<SearchOutcome> {
  const key = searchCacheKey(query, kind);
  const cached = await prisma.searchCache.findUnique({ where: { query: key } });
  if (cached && Date.now() - cached.fetchedAt.getTime() < SEARCH_CACHE_TTL_MS) {
    return { results: await withImdbRatings(cached.results as unknown as SearchResult[]), partial: false };
  }

  try {
    return {
      results: await withImdbRatings(await fetchAndStoreSearch(query, kind, LIVE_SEARCH_TIMEOUT_MS, 0)),
      partial: false,
    };
  } catch (error) {
    console.warn(`TMDB araması yetişmedi ("${key}"), kayıtlı sonuçlar gösteriliyor:`, error);
    const fallback = cached ? (cached.results as unknown as SearchResult[]) : await searchStoredTitles(query, kind);
    return { results: await withImdbRatings(fallback), partial: true };
  }
}

/** Completes a search that timed out, so the next visit gets full results. Never throws. */
export async function refreshSearchCache(query: string, kind: SearchKind = "all"): Promise<void> {
  try {
    await fetchAndStoreSearch(query, kind, BACKGROUND_SEARCH_TIMEOUT_MS, 1);
  } catch (error) {
    console.error(`Arka planda arama tamamlanamadı ("${searchCacheKey(query, kind)}"):`, error);
  }
}

export function isStale(lastSyncedAt: Date | null, status: string | null, now = Date.now()) {
  if (!lastSyncedAt) return true;
  const interval = status && FINISHED_STATUSES.has(status) ? REFRESH_INTERVAL_DEFAULT_MS : REFRESH_INTERVAL_RUNNING_MS;
  return now - lastSyncedAt.getTime() > interval;
}

/** Due a refresh, or stored before the cast and where-to-watch data were fetched with titles. */
function needsRefresh(title: {
  lastSyncedAt: Date | null;
  status: string | null;
  castMembers: unknown;
  watchProviders: unknown;
}) {
  return isStale(title.lastSyncedAt, title.status) || title.castMembers === null || title.watchProviders === null;
}

// ---------- Storing a series ----------

/** Average episode length: TMDB's series value if present, otherwise the mean of the episodes' runtimes. */
export function averageRuntime(show: Pick<TmdbTvWithSeasons, "episode_run_time" | "seasonsWithEpisodes">) {
  const declared = show.episode_run_time.filter((n) => n > 0);
  const values = declared.length
    ? declared
    : show.seasonsWithEpisodes.flatMap((s) => s.episodes.map((ep) => ep.runtime ?? 0)).filter((n) => n > 0);
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

/** TMDB air dates have no time; stored as midnight UTC (timestamp without time zone, Prisma's convention). */
export function airDateFromTmdb(date: string | null | undefined): string | null {
  return date ? new Date(`${date}T00:00:00Z`).toISOString() : null;
}

/**
 * Stores a TMDB series. Episodes are matched on (season, episode number), so rows that already exist — and
 * the watch history pointing at them — are kept and updated in place. Episodes the source no longer lists are
 * removed only if nobody has watched them.
 * `existingTitleId` updates that title (used when moving a series over from the old data source).
 */
async function saveSeries(show: TmdbTvWithSeasons, existingTitleId?: string) {
  const titleData = {
    tmdbId: show.id,
    imdbId: show.external_ids?.imdb_id || null,
    name: cleanText(show.name) ?? show.name,
    overview: cleanText(show.overview),
    posterUrl: tmdbImage(show.poster_path, "w500"),
    backdropUrl: tmdbImage(show.backdrop_path, "w1280"),
    sourceRating: tmdbRating(show.vote_average, show.vote_count),
    runtime: averageRuntime(show),
    releaseDate: show.first_air_date ? new Date(show.first_air_date) : null,
    status: show.status || null,
    genres: show.genres.map((g) => cleanText(g.name)).filter((g): g is string => Boolean(g)),
    castMembers: castFromAggregate(show.aggregate_credits?.cast ?? []),
    watchProviders: providersFromTmdb(show["watch/providers"]),
  };

  const existing =
    (existingTitleId && (await prisma.title.findUnique({ where: { id: existingTitleId }, select: { id: true } }))) ||
    (await prisma.title.findFirst({ where: { tmdbId: show.id, type: "SERIES" }, select: { id: true } }));
  // lastSyncedAt is only set once seasons and episodes are stored, so a failed sync is retried next time
  const title = existing
    ? await prisma.title.update({ where: { id: existing.id }, data: titleData })
    : await prisma.title.create({ data: { type: "SERIES", ...titleData } });

  const seasonsWithEpisodes = show.seasonsWithEpisodes.filter((s) => s.episodes.length > 0);
  const seasonRows = seasonsWithEpisodes.map((s) => ({
    id: randomUUID(),
    seasonNumber: s.season_number,
    name: cleanText(s.name),
    posterUrl: tmdbImage(s.poster_path, "w342"),
  }));

  // Bulk upserts: one statement per batch instead of one round trip per row (long shows have 800+ episodes)
  const seasons = seasonRows.length
    ? await prisma.$queryRaw<{ id: string; seasonNumber: number }[]>`
        INSERT INTO "Season" ("id", "titleId", "seasonNumber", "name", "posterUrl")
        SELECT x."id", ${title.id}, x."seasonNumber", x."name", x."posterUrl"
        FROM jsonb_to_recordset(${JSON.stringify(seasonRows)}::jsonb)
          AS x("id" text, "seasonNumber" int, "name" text, "posterUrl" text)
        ON CONFLICT ("titleId", "seasonNumber") DO UPDATE
          SET "name" = EXCLUDED."name", "posterUrl" = EXCLUDED."posterUrl"
        RETURNING "id", "seasonNumber"`
    : [];
  const seasonIdByNumber = new Map(seasons.map((s) => [s.seasonNumber, s.id]));

  const episodeRows = seasonsWithEpisodes.flatMap((s) =>
    s.episodes.map((ep) => ({
      id: randomUUID(),
      tmdbId: ep.id,
      seasonId: seasonIdByNumber.get(s.season_number)!,
      episodeNumber: ep.episode_number,
      name: cleanText(ep.name) ?? `${ep.episode_number}. Bölüm`,
      overview: cleanText(ep.overview),
      runtime: ep.runtime || null,
      sourceRating: tmdbRating(ep.vote_average, ep.vote_count),
      airDate: airDateFromTmdb(ep.air_date),
      stillUrl: tmdbImage(ep.still_path, "w780"),
    })),
  );

  const keptIds: string[] = [];
  for (let i = 0; i < episodeRows.length; i += EPISODE_BATCH_SIZE) {
    const batch = episodeRows.slice(i, i + EPISODE_BATCH_SIZE);
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO "Episode"
        ("id", "tmdbId", "seasonId", "episodeNumber", "name", "overview", "runtime", "sourceRating", "airDate", "stillUrl")
      SELECT x."id", x."tmdbId", x."seasonId", x."episodeNumber", x."name", x."overview", x."runtime",
             x."sourceRating", x."airDate", x."stillUrl"
      FROM jsonb_to_recordset(${JSON.stringify(batch)}::jsonb) AS x(
        "id" text, "tmdbId" int, "seasonId" text, "episodeNumber" int, "name" text, "overview" text,
        "runtime" int, "sourceRating" double precision, "airDate" timestamp(3), "stillUrl" text)
      ON CONFLICT ("seasonId", "episodeNumber") DO UPDATE SET
        "tmdbId" = EXCLUDED."tmdbId",
        "name" = EXCLUDED."name",
        "overview" = EXCLUDED."overview",
        "runtime" = EXCLUDED."runtime",
        "sourceRating" = EXCLUDED."sourceRating",
        "airDate" = EXCLUDED."airDate",
        "stillUrl" = EXCLUDED."stillUrl"
      RETURNING "id"`;
    keptIds.push(...rows.map((r) => r.id));
  }

  // Drop episodes the source no longer lists, unless someone has watched them
  await prisma.$executeRaw`
    DELETE FROM "Episode" AS e
    USING "Season" AS s
    WHERE e."seasonId" = s."id"
      AND s."titleId" = ${title.id}
      AND NOT (e."id" = ANY(${keptIds}::text[]))
      AND NOT EXISTS (SELECT 1 FROM "WatchedEpisode" AS w WHERE w."episodeId" = e."id")`;

  await prisma.title.update({ where: { id: title.id }, data: { lastSyncedAt: new Date() } });
  return title.id;
}

const seriesInclude = {
  seasons: {
    orderBy: { seasonNumber: "asc" },
    include: { episodes: { orderBy: { episodeNumber: "asc" } } },
  },
} as const;

// A first visit waits this long for the data source; slower answers are finished in the background
const FIRST_LOAD_TIMEOUT_MS = 10_000;
const BACKGROUND_LOAD_TIMEOUT_MS = 60_000;

function findStoredSeries(tmdbId: number) {
  return prisma.title.findFirst({ where: { tmdbId, type: "SERIES" }, include: seriesInclude });
}

export type Series = NonNullable<Awaited<ReturnType<typeof findStoredSeries>>>;

export type SeriesLookup =
  /** `stale`: shown as is; the caller should run refreshSeries in the background */
  | { status: "ready"; series: Series; stale: boolean }
  /** Not stored yet and TMDB did not answer in time; refreshSeries will finish it */
  | { status: "preparing" };

/**
 * Stale-while-revalidate: a stored series is always returned at once (flagged when it is due a refresh), so
 * visitors never wait for the data source. Only a series nobody has opened yet is fetched while the visitor
 * waits, for at most FIRST_LOAD_TIMEOUT_MS. Unknown TMDB ids throw a TmdbError with status 404.
 */
export async function lookupSeries(tmdbId: number): Promise<SeriesLookup> {
  const stored = await findStoredSeries(tmdbId);
  if (stored) return { status: "ready", series: stored, stale: needsRefresh(stored) };

  try {
    await saveSeries(await tmdb.getTvWithSeasons(tmdbId, { timeoutMs: FIRST_LOAD_TIMEOUT_MS, retries: 0 }));
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) throw error;
    console.warn(`TMDB dizi isteği yetişmedi (tmdbId=${tmdbId}), arka planda devam edilecek:`, error);
    return { status: "preparing" };
  }
  return { status: "ready", series: (await findStoredSeries(tmdbId))!, stale: false };
}

const seriesRefreshInFlight = new Set<number>();

/** Fetches a series from TMDB (waiting up to a minute) and stores it. Meant for after(); never throws. */
export async function refreshSeries(tmdbId: number): Promise<void> {
  if (seriesRefreshInFlight.has(tmdbId)) return;
  seriesRefreshInFlight.add(tmdbId);
  try {
    await saveSeries(await tmdb.getTvWithSeasons(tmdbId, { timeoutMs: BACKGROUND_LOAD_TIMEOUT_MS, retries: 1 }));
  } catch (error) {
    console.error(`Dizi arka planda güncellenemedi (tmdbId=${tmdbId}):`, error);
  } finally {
    seriesRefreshInFlight.delete(tmdbId);
  }
}

// ---------- Movies ----------

async function saveMovie(movie: TmdbMovieDetails) {
  const data = {
    tmdbId: movie.id,
    imdbId: movie.imdb_id || null,
    name: cleanText(movie.title) ?? movie.title,
    overview: cleanText(movie.overview),
    posterUrl: tmdbImage(movie.poster_path, "w500"),
    backdropUrl: tmdbImage(movie.backdrop_path, "w1280"),
    sourceRating: tmdbRating(movie.vote_average, movie.vote_count),
    runtime: movie.runtime || null,
    releaseDate: movie.release_date ? new Date(movie.release_date) : null,
    status: movie.status || null,
    genres: movie.genres.map((g) => cleanText(g.name)).filter((g): g is string => Boolean(g)),
    castMembers: castFromCredits(movie.credits?.cast ?? []),
    watchProviders: providersFromTmdb(movie["watch/providers"]),
    lastSyncedAt: new Date(),
  };
  const existing = await prisma.title.findFirst({ where: { tmdbId: movie.id, type: "MOVIE" }, select: { id: true } });
  if (existing) await prisma.title.update({ where: { id: existing.id }, data });
  else await prisma.title.create({ data: { type: "MOVIE", ...data } });
}

function findStoredMovie(tmdbId: number) {
  return prisma.title.findFirst({ where: { tmdbId, type: "MOVIE" } });
}

export type Movie = NonNullable<Awaited<ReturnType<typeof findStoredMovie>>>;

export type MovieLookup = { status: "ready"; movie: Movie; stale: boolean } | { status: "preparing" };

/** Same stale-while-revalidate rules as lookupSeries. Unknown TMDB ids throw a TmdbError with status 404. */
export async function lookupMovie(tmdbId: number): Promise<MovieLookup> {
  const stored = await findStoredMovie(tmdbId);
  if (stored) return { status: "ready", movie: stored, stale: needsRefresh(stored) };

  try {
    await saveMovie(await tmdb.getMovie(tmdbId, { timeoutMs: FIRST_LOAD_TIMEOUT_MS, retries: 0 }));
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) throw error;
    console.warn(`TMDB film isteği yetişmedi (tmdbId=${tmdbId}), arka planda devam edilecek:`, error);
    return { status: "preparing" };
  }
  return { status: "ready", movie: (await findStoredMovie(tmdbId))!, stale: false };
}

const movieRefreshInFlight = new Set<number>();

/** Fetches a movie from TMDB and stores it. Meant for after(); never throws. */
export async function refreshMovie(tmdbId: number): Promise<void> {
  if (movieRefreshInFlight.has(tmdbId)) return;
  movieRefreshInFlight.add(tmdbId);
  try {
    await saveMovie(await tmdb.getMovie(tmdbId, { timeoutMs: BACKGROUND_LOAD_TIMEOUT_MS, retries: 1 }));
  } catch (error) {
    console.error(`Film arka planda güncellenemedi (tmdbId=${tmdbId}):`, error);
  } finally {
    movieRefreshInFlight.delete(tmdbId);
  }
}

/**
 * Moves a series stored from the old data source (TVmaze) over to TMDB, keeping its rows and watch history.
 * Used by scripts/migrate-to-tmdb.ts. Returns the TMDB id, or null if no match was found.
 */
export async function moveSeriesToTmdb(title: {
  id: string;
  name: string;
  imdbId: string | null;
  releaseDate: Date | null;
}): Promise<number | null> {
  let tmdbId = title.imdbId ? await tmdb.findTvByImdbId(title.imdbId) : null;
  if (!tmdbId) {
    // No IMDb id: same name and first-air year
    const year = title.releaseDate?.getUTCFullYear();
    const candidates = await tmdb.searchTv(title.name);
    tmdbId =
      candidates.find(
        (c) =>
          c.name.toLocaleLowerCase("tr-TR") === title.name.toLocaleLowerCase("tr-TR") &&
          (!year || c.first_air_date?.startsWith(String(year))),
      )?.id ?? null;
  }
  if (!tmdbId) return null;
  await saveSeries(
    await tmdb.getTvWithSeasons(tmdbId, { timeoutMs: BACKGROUND_LOAD_TIMEOUT_MS, retries: 2 }),
    title.id,
  );
  return tmdbId;
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

// ---------- Discover (home page) ----------

const DISCOVER_TIMEOUT_MS = 4_000;
const DISCOVER_LIMIT = 12;
// TMDB's weekly lists change slowly; one fetch serves every visitor for a few hours
const DISCOVER_REVALIDATE_SECONDS = 6 * 60 * 60;

async function fetchDiscoverLists() {
  const options = { timeoutMs: DISCOVER_TIMEOUT_MS, retries: 0 };
  const noGenres = () => new Map<number, string>();
  const [series, movies, inCinemas, tvGenres, movieGenres] = await Promise.all([
    tmdb.trending("tv", options),
    tmdb.trending("movie", options),
    tmdb.nowPlaying(options),
    tmdb.tvGenres(options).catch(noGenres),
    tmdb.movieGenres(options).catch(noGenres),
  ]);
  return {
    popularSeries: series.slice(0, DISCOVER_LIMIT).map((item) => toSearchResult(item, tvGenres)),
    popularMovies: movies.slice(0, DISCOVER_LIMIT).map((item) => movieSearchResult(item, movieGenres)),
    inCinemas: inCinemas.slice(0, DISCOVER_LIMIT).map((item) => movieSearchResult(item, movieGenres)),
  };
}

// A failed fetch throws, so it is not cached and the next visit tries again
const cachedDiscoverLists = unstable_cache(fetchDiscoverLists, ["discover-lists-v1"], {
  revalidate: DISCOVER_REVALIDATE_SECONDS,
});

export type DiscoverLists = Awaited<ReturnType<typeof fetchDiscoverLists>>;

/** "Bu hafta popüler diziler / filmler" and "Vizyonda". Empty lists when TMDB is slow or down. */
export async function getDiscoverLists(): Promise<DiscoverLists> {
  try {
    return await cachedDiscoverLists();
  } catch (error) {
    console.warn("Keşfet listeleri alınamadı:", error);
    return { popularSeries: [], popularMovies: [], inCinemas: [] };
  }
}
