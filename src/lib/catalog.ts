import "server-only";
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

export type SearchResult = {
  tvmazeId: number;
  type: "SERIES";
  name: string;
  posterUrl: string | null;
  year: number | null;
  status: string | null;
  sourceRating: number | null;
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
    genres: show.genres ?? [],
    overview: stripHtml(show.summary),
  };
}

/** Search results are not stored; only opened titles are cached. */
export async function searchTitles(query: string): Promise<SearchResult[]> {
  const shows = await tvmaze.searchShows(query);
  return shows.map(toSearchResult);
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
    lastSyncedAt: new Date(),
  };

  const title = await prisma.title.upsert({
    where: { tvmazeId: show.id },
    create: { tvmazeId: show.id, type: "SERIES", ...titleData },
    update: titleData,
  });

  // Specials have no episode number and do not fit the (season, episodeNumber) key, so they are skipped
  const episodes = (show._embedded?.episodes ?? []).filter((ep) => ep.number != null);
  const seasonInfo = new Map((show._embedded?.seasons ?? []).map((s) => [s.number, s]));
  const seasonNumbers = [...new Set(episodes.map((ep) => ep.season))];

  const seasons = await prisma.$transaction(
    seasonNumbers.map((seasonNumber) => {
      const info = seasonInfo.get(seasonNumber);
      const data = { name: info?.name || null, posterUrl: info?.image?.original ?? info?.image?.medium ?? null };
      return prisma.season.upsert({
        where: { titleId_seasonNumber: { titleId: title.id, seasonNumber } },
        create: { titleId: title.id, seasonNumber, ...data },
        update: data,
      });
    }),
  );
  const seasonIdByNumber = new Map(seasons.map((s) => [s.seasonNumber, s.id]));

  await prisma.$transaction(
    episodes.map((ep) => {
      const data = {
        seasonId: seasonIdByNumber.get(ep.season)!,
        episodeNumber: ep.number!,
        name: ep.name,
        overview: stripHtml(ep.summary),
        runtime: ep.runtime,
        sourceRating: ep.rating?.average ?? null,
        airDate: ep.airstamp ? new Date(ep.airstamp) : null,
        stillUrl: ep.image?.original ?? ep.image?.medium ?? null,
      };
      return prisma.episode.upsert({
        where: { tvmazeId: ep.id },
        create: { tvmazeId: ep.id, ...data },
        update: data,
      });
    }),
  );
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
