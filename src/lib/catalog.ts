import "server-only";
import { randomUUID } from "node:crypto";
import { omdb, OmdbError, isOmdbEnabled } from "@/lib/omdb";
import { prisma } from "@/lib/prisma";
import { pickBackdrop, stripHtml, tvmaze, type TvmazeShow, type TvmazeShowWithEmbeds } from "@/lib/tvmaze";

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

// Search results are kept briefly in memory: popular queries repeat a lot and TVmaze is rate-limited
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
const SEARCH_CACHE_MAX_ENTRIES = 200;
const searchCache = new Map<string, { expires: number; results: SearchResult[] }>();

async function searchTvmazeCached(query: string): Promise<SearchResult[]> {
  const key = query.trim().toLocaleLowerCase("tr-TR");
  const hit = searchCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.results;

  const results = (await tvmaze.searchShows(query)).map(toSearchResult);
  if (searchCache.size >= SEARCH_CACHE_MAX_ENTRIES) searchCache.delete(searchCache.keys().next().value!);
  searchCache.set(key, { expires: Date.now() + SEARCH_CACHE_TTL_MS, results });
  return results;
}

/** Search results are not stored in the database; only opened titles are (their IMDb rating is added if known). */
export async function searchTitles(query: string): Promise<SearchResult[]> {
  const results = await searchTvmazeCached(query);
  if (results.length === 0) return results;

  const cached = await prisma.title.findMany({
    where: { tvmazeId: { in: results.map((r) => r.tvmazeId) }, imdbRating: { not: null } },
    select: { tvmazeId: true, imdbRating: true },
  });
  const imdbByTvmazeId = new Map(cached.map((t) => [t.tvmazeId, t.imdbRating]));
  return results.map((r) => ({ ...r, imdbRating: imdbByTvmazeId.get(r.tvmazeId) ?? null }));
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

/**
 * Returns a series with its seasons and episodes, fetching or refreshing it from TVmaze when needed.
 * If TVmaze is unreachable, stale cached data is returned instead of failing.
 */
export async function getSeries(tvmazeId: number) {
  const cached = await prisma.title.findUnique({ where: { tvmazeId }, include: seriesInclude });

  if (cached && !isStale(cached.lastSyncedAt, cached.status)) return cached;

  try {
    await saveSeries(await tvmaze.getShowWithEpisodes(tvmazeId));
  } catch (error) {
    if (cached) {
      console.error(`TVmaze güncellemesi başarısız, önbellekteki veri kullanılıyor (tvmazeId=${tvmazeId}):`, error);
      return cached;
    }
    throw error;
  }

  return prisma.title.findUniqueOrThrow({ where: { tvmazeId }, include: seriesInclude });
}

export type Series = Awaited<ReturnType<typeof getSeries>>;

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
