import "server-only";
import { unstable_cache } from "next/cache";
import { movieSearchResult, toSearchResult, type SearchResult } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { getFavoriteCharacters } from "@/lib/profile";
import { genreIdsFor, joinTurkish, pickSeed, rankCredits, rankGenres, titleWeight, unseen } from "@/lib/recommend";
import { tmdb, type TmdbPersonCredit } from "@/lib/tmdb";

/**
 * "Sana özel" rows on the home page (signed-in users): favourite genres, "X izleyenler bunları da sevdi",
 * the favourite character's actor and what followed friends watch. Each row is left out when it has nothing
 * to show or TMDB does not answer in time; nothing already watched or listed is suggested.
 */

const ROW_LIMIT = 15;
const DAY_MS = 24 * 60 * 60 * 1000;
const TMDB_OPTIONS = { timeoutMs: 4_000, retries: 0 };
// TMDB answers are the same for everyone with the same inputs; a few hours is fresh enough
const REVALIDATE = 6 * 60 * 60;

const cachedTvDiscover = unstable_cache(
  (genreIds: number[]) => tmdb.discover("tv", genreIds, TMDB_OPTIONS),
  ["rec-discover-tv-v1"],
  {
    revalidate: REVALIDATE,
  },
);
const cachedMovieDiscover = unstable_cache(
  (genreIds: number[]) => tmdb.discover("movie", genreIds, TMDB_OPTIONS),
  ["rec-discover-movie-v1"],
  { revalidate: REVALIDATE },
);
const cachedRecommendations = unstable_cache(
  (kind: "tv" | "movie", id: number) => tmdb.recommendations(kind, id, TMDB_OPTIONS),
  ["rec-similar-v1"],
  { revalidate: REVALIDATE },
);
const cachedCredits = unstable_cache(
  (personId: number) => tmdb.personCredits(personId, TMDB_OPTIONS),
  ["rec-credits-v1"],
  {
    revalidate: REVALIDATE,
  },
);

export type RecommendedTitle = SearchResult & { note?: string };
export type RecommendationRow = { id: string; title: string; reason: string; items: RecommendedTitle[] };

/** What the user watched (with weights and ratings) and everything to leave out of suggestions. */
async function history(userId: string) {
  const [series, movies, listed] = await Promise.all([
    prisma.$queryRaw<
      {
        id: string;
        tmdbId: number;
        name: string;
        genres: string[];
        episodes: bigint;
        rating: number | null;
        last: Date;
      }[]
    >`
      SELECT t."id", t."tmdbId", t."name", t."genres", COUNT(*) AS episodes, AVG(w."rating")::float AS rating,
             MAX(w."watchedAt") AS last
      FROM "WatchedEpisode" w JOIN "Episode" e ON e."id" = w."episodeId"
      JOIN "Season" s ON s."id" = e."seasonId" JOIN "Title" t ON t."id" = s."titleId"
      WHERE w."userId" = ${userId} AND t."tmdbId" > 0
      GROUP BY t."id"`,
    prisma.watchedMovie.findMany({
      where: { userId, title: { tmdbId: { gt: 0 } } },
      select: {
        rating: true,
        watchedAt: true,
        title: { select: { id: true, tmdbId: true, name: true, genres: true } },
      },
    }),
    prisma.watchlistItem.findMany({ where: { userId }, select: { title: { select: { type: true, tmdbId: true } } } }),
  ]);
  const watched = [
    ...series.map((s) => ({
      type: "SERIES" as const,
      tmdbId: s.tmdbId,
      name: s.name,
      genres: s.genres,
      rating: s.rating,
      last: s.last,
      weight: titleWeight(Number(s.episodes), s.rating),
    })),
    ...movies.map((m) => ({
      type: "MOVIE" as const,
      tmdbId: m.title.tmdbId!,
      name: m.title.name,
      genres: m.title.genres,
      rating: m.rating,
      last: m.watchedAt,
      weight: titleWeight(1, m.rating),
    })),
  ].sort((a, b) => b.last.getTime() - a.last.getTime());
  const known = new Set([
    ...watched.map((w) => `${w.type}-${w.tmdbId}`),
    ...listed.map((l) => `${l.title.type}-${l.title.tmdbId}`),
  ]);
  return { watched, known };
}

type History = Awaited<ReturnType<typeof history>>;

async function genres() {
  const none = () => new Map<number, string>();
  const [tv, movie] = await Promise.all([
    tmdb.tvGenres(TMDB_OPTIONS).catch(none),
    tmdb.movieGenres(TMDB_OPTIONS).catch(none),
  ]);
  return { tv, movie };
}

/** "Sana özel": popular series and movies in the user's three favourite genres. */
async function forYouRow({ watched }: History, g: Awaited<ReturnType<typeof genres>>) {
  const favorites = rankGenres(watched);
  if (favorites.length === 0) return null;
  const [tvIds, movieIds] = [genreIdsFor(favorites, g.tv), genreIdsFor(favorites, g.movie)];
  const [series, movies] = await Promise.all([
    tvIds.length ? cachedTvDiscover(tvIds) : [],
    movieIds.length ? cachedMovieDiscover(movieIds) : [],
  ]);
  // Series and movies taken in turn, so neither crowds out the other
  const mixed: RecommendedTitle[] = [];
  for (let i = 0; i < Math.max(series.length, movies.length); i++) {
    if (series[i]) mixed.push(toSearchResult(series[i], g.tv));
    if (movies[i]) mixed.push(movieSearchResult(movies[i], g.movie));
  }
  return { id: "for-you", title: "Sana özel", reason: `${joinTurkish(favorites)} sevdiğin için`, items: mixed };
}

/** "<Title> izleyenler bunları da sevdi": TMDB's recommendations for one title the user liked. */
async function becauseRow({ watched }: History, g: Awaited<ReturnType<typeof genres>>) {
  const seed = pickSeed(watched, Math.floor(Date.now() / DAY_MS));
  if (!seed) return null;
  const results = await cachedRecommendations(seed.type === "SERIES" ? "tv" : "movie", seed.tmdbId);
  return {
    id: "because",
    title: `${seed.name} izleyenler bunları da sevdi`,
    reason: seed.rating !== null && seed.rating >= 8 ? "Yüksek puan verdiğin bir yapım" : "Son izlediklerinden",
    items: results.map((r) => (r.media_type === "tv" ? toSearchResult(r, g.tv) : movieSearchResult(r, g.movie))),
  };
}

/** "<Actor> başka nerelerde oynadı?": the other work of the actor behind the user's favourite character. */
async function actorRow(userId: string, g: Awaited<ReturnType<typeof genres>>) {
  const [favorite] = await getFavoriteCharacters(userId);
  if (!favorite?.actorName) return null;
  const credits = rankCredits(await cachedCredits(favorite.castId));
  const toResult = (c: TmdbPersonCredit): RecommendedTitle => ({
    ...(c.media_type === "tv" ? toSearchResult(c, g.tv) : movieSearchResult(c, g.movie)),
    note: c.character ?? undefined,
  });
  return {
    id: "actor",
    title: `${favorite.actorName} başka nerelerde oynadı?`,
    reason: `Favori karakterin ${favorite.character} (${favorite.title.name})`,
    items: credits.map(toResult),
  };
}

/** "Arkadaşların izliyor": what the people the user follows watched in the last 30 days. */
async function friendsRow(userId: string) {
  const since = new Date(Date.now() - 30 * DAY_MS);
  const rows = await prisma.$queryRaw<
    {
      tmdbId: number;
      type: "SERIES" | "MOVIE";
      name: string;
      posterUrl: string | null;
      releaseDate: Date | null;
      sourceRating: number | null;
      imdbRating: number | null;
      genres: string[];
      friends: bigint;
    }[]
  >`
    SELECT t."tmdbId", t."type", t."name", t."posterUrl", t."releaseDate", t."sourceRating", t."imdbRating", t."genres",
           COUNT(DISTINCT w."userId") AS friends
    FROM (
      SELECT we."userId", s."titleId", we."watchedAt"
      FROM "WatchedEpisode" we JOIN "Episode" e ON e."id" = we."episodeId" JOIN "Season" s ON s."id" = e."seasonId"
      UNION ALL
      SELECT wm."userId", wm."titleId", wm."watchedAt" FROM "WatchedMovie" wm
    ) w
    JOIN "Title" t ON t."id" = w."titleId"
    JOIN "Follow" f ON f."followingId" = w."userId" AND f."followerId" = ${userId}
    JOIN "User" u ON u."id" = w."userId" AND u."isPrivate" = false
    WHERE w."watchedAt" >= ${since} AND t."tmdbId" > 0
    GROUP BY t."id"
    ORDER BY friends DESC, MAX(w."watchedAt") DESC
    LIMIT 40`;
  if (rows.length === 0) return null;
  return {
    id: "friends",
    title: "Arkadaşların izliyor",
    reason: "Takip ettiklerinin son 30 günde izledikleri",
    items: rows.map((r): RecommendedTitle => ({
      tmdbId: r.tmdbId,
      type: r.type,
      name: r.name,
      posterUrl: r.posterUrl,
      year: r.releaseDate?.getFullYear() ?? null,
      status: null,
      sourceRating: r.sourceRating,
      imdbRating: r.imdbRating,
      genres: r.genres,
      overview: null,
      note: `${Number(r.friends)} arkadaşın izledi`,
    })),
  };
}

export async function getRecommendations(userId: string): Promise<RecommendationRow[]> {
  const [past, g] = await Promise.all([history(userId), genres()]);
  const safe = async (label: string, row: Promise<RecommendationRow | null>) => {
    try {
      return await row;
    } catch (error) {
      console.warn(`Öneri satırı hazırlanamadı (${label}):`, error);
      return null;
    }
  };
  const rows = await Promise.all([
    safe("sana özel", forYouRow(past, g)),
    safe("benzerleri", becauseRow(past, g)),
    safe("oyuncu", actorRow(userId, g)),
    safe("arkadaşlar", friendsRow(userId)),
  ]);
  return rows
    .filter((row): row is RecommendationRow => row !== null)
    .map((row) => ({ ...row, items: unseen(row.items, past.known).slice(0, ROW_LIMIT) }))
    .filter((row) => row.items.length > 0);
}
