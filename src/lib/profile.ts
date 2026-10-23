import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { characterLabel, parseCast } from "@/lib/cast";
import { isStale, titleHref } from "@/lib/catalog";
import { formatCommentTime } from "@/lib/comments";
import { episodeCode } from "@/lib/format";
import { nextEpisode, watchProgress } from "@/lib/watch";

/**
 * Data for the profile page (PROJE_PLANI.md §4.7) and the watch lists (§4.8).
 * Everything here is public except personal notes, which are never selected.
 */

export const getProfileUser = cache((username: string) =>
  prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      isPrivate: true,
      coverPath: true,
      coverPositionY: true,
      coverCharacterTitleId: true,
      coverCharacterCastId: true,
      createdAt: true,
    },
  }),
);

/**
 * Total minutes and counts. Episodes without a runtime count with the series' average episode length;
 * every rewatch adds its length again.
 */
export async function getWatchStats(userId: string) {
  const [[episodes], [movies]] = await Promise.all([
    prisma.$queryRaw<{ minutes: bigint; count: bigint; rewatches: bigint }[]>`
      SELECT COALESCE(SUM(COALESCE(e."runtime", t."runtime", 0) * (1 + cardinality(w."rewatchedAt"))), 0) AS minutes,
             COUNT(*) AS count, COALESCE(SUM(cardinality(w."rewatchedAt")), 0) AS rewatches
      FROM "WatchedEpisode" w
      JOIN "Episode" e ON e."id" = w."episodeId"
      JOIN "Season" s ON s."id" = e."seasonId"
      JOIN "Title" t ON t."id" = s."titleId"
      WHERE w."userId" = ${userId}`,
    prisma.$queryRaw<{ minutes: bigint; count: bigint; rewatches: bigint }[]>`
      SELECT COALESCE(SUM(COALESCE(t."runtime", 0) * (1 + cardinality(w."rewatchedAt"))), 0) AS minutes,
             COUNT(*) AS count, COALESCE(SUM(cardinality(w."rewatchedAt")), 0) AS rewatches
      FROM "WatchedMovie" w
      JOIN "Title" t ON t."id" = w."titleId"
      WHERE w."userId" = ${userId}`,
  ]);
  return {
    seriesMinutes: Number(episodes.minutes),
    episodeCount: Number(episodes.count),
    episodeRewatches: Number(episodes.rewatches),
    movieMinutes: Number(movies.minutes),
    movieCount: Number(movies.count),
    movieRewatches: Number(movies.rewatches),
  };
}

export type EpisodeLink = {
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  episodeId: string;
  airDate: Date | null;
};

/**
 * Series the user follows: everything they have watched an episode of, plus series on their
 * "Daha sonra izle" list (those start from the first episode). For each: progress, where they left off,
 * the next aired episode and the next episode still to air. Most recent activity first.
 */
export const getTrackedSeries = cache(async (userId: string) => {
  const [watched, listed] = await Promise.all([
    prisma.watchedEpisode.findMany({
      where: { userId },
      select: { episodeId: true, watchedAt: true, episode: { select: { season: { select: { titleId: true } } } } },
    }),
    prisma.watchlistItem.findMany({
      where: { userId, title: { type: "SERIES" } },
      select: { titleId: true, addedAt: true },
    }),
  ]);

  const lastWatchedAt = new Map<string, Date>();
  for (const w of watched) {
    const titleId = w.episode.season.titleId;
    const prev = lastWatchedAt.get(titleId);
    if (!prev || w.watchedAt > prev) lastWatchedAt.set(titleId, w.watchedAt);
  }
  const addedAt = new Map(listed.map((l) => [l.titleId, l.addedAt]));
  const ids = [...new Set([...lastWatchedAt.keys(), ...addedAt.keys()])];
  if (ids.length === 0) return [];
  const watchedIds = new Set(watched.map((w) => w.episodeId));

  const titles = await prisma.title.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      tmdbId: true,
      name: true,
      posterUrl: true,
      status: true,
      lastSyncedAt: true,
      seasons: {
        select: {
          seasonNumber: true,
          episodes: { select: { id: true, episodeNumber: true, name: true, airDate: true } },
        },
      },
    },
  });

  type Item = {
    seasonNumber: number;
    episode: { id: string; episodeNumber: number; name: string; airDate: Date | null };
  } | null;
  const toLink = (item: Item): EpisodeLink | null =>
    item && {
      seasonNumber: item.seasonNumber,
      episodeNumber: item.episode.episodeNumber,
      name: item.episode.name,
      episodeId: item.episode.id,
      airDate: item.episode.airDate,
    };

  return titles
    .map((title) => {
      const { last, next, upcoming } = nextEpisode(title.seasons, watchedIds);
      const lastWatched = lastWatchedAt.get(title.id) ?? null;
      return {
        id: title.id,
        tmdbId: title.tmdbId,
        name: title.name,
        posterUrl: title.posterUrl,
        status: title.status,
        lastSyncedAt: title.lastSyncedAt,
        progress: watchProgress(title.seasons, watchedIds),
        /** Something of it is watched (otherwise it is only on the watch-later list) */
        started: lastWatched !== null,
        inWatchlist: addedAt.has(title.id),
        lastWatchedAt: lastWatched,
        /** Last watch, or when it was put on the list */
        activityAt: lastWatched ?? addedAt.get(title.id)!,
        last: toLink(last),
        next: toLink(next),
        upcoming: toLink(upcoming),
      };
    })
    .sort((a, b) => b.activityAt.getTime() - a.activityAt.getTime());
});

export type TrackedSeries = Awaited<ReturnType<typeof getTrackedSeries>>[number];

/** "İzlediğim Diziler" on the profile: series with at least one watched episode. */
export async function getSeriesProgress(userId: string) {
  return (await getTrackedSeries(userId)).filter((s) => s.started);
}

export type SeriesProgress = TrackedSeries;

/**
 * "İzlemeye devam et": started series with an aired episode still to watch, and series on the watch-later
 * list from their first episode.
 */
export async function getContinueWatching(userId: string) {
  return (await getTrackedSeries(userId)).filter((s): s is TrackedSeries & { next: EpisodeLink } => s.next !== null);
}

export type UpcomingItem = {
  key: string;
  href: string;
  name: string;
  posterUrl: string | null;
  /** "S02E05 · Bölüm adı", or "Vizyon" for a movie */
  label: string;
  airDate: Date;
};

/**
 * "Yakında": the next episode still to air of every followed series and movies on the watch-later list
 * that are not released yet, soonest first.
 */
export async function getUpcoming(userId: string): Promise<UpcomingItem[]> {
  const now = new Date();
  const [series, movies] = await Promise.all([
    getTrackedSeries(userId),
    prisma.watchlistItem.findMany({
      where: { userId, title: { type: "MOVIE", releaseDate: { gt: now } } },
      select: { title: { select: { id: true, tmdbId: true, name: true, posterUrl: true, releaseDate: true } } },
    }),
  ]);
  const items: UpcomingItem[] = [
    ...series
      .filter((s) => s.upcoming?.airDate)
      .map((s) => ({
        key: s.id,
        href: `/series/${s.tmdbId}/season/${s.upcoming!.seasonNumber}/episode/${s.upcoming!.episodeNumber}`,
        name: s.name,
        posterUrl: s.posterUrl,
        label: `${episodeCode(s.upcoming!.seasonNumber, s.upcoming!.episodeNumber)} · ${s.upcoming!.name}`,
        airDate: s.upcoming!.airDate!,
      })),
    ...movies.map(({ title }) => ({
      key: title.id,
      href: `/movie/${title.tmdbId}`,
      name: title.name,
      posterUrl: title.posterUrl,
      label: "Vizyon",
      airDate: title.releaseDate!,
    })),
  ];
  return items.sort((a, b) => a.airDate.getTime() - b.airDate.getTime());
}

/**
 * Followed series due a refresh from TMDB, so new episodes and air dates show up in "Yakında" without anyone
 * opening the series page. Callers refresh them after the response.
 */
export async function staleTrackedSeries(userId: string, limit = 5) {
  return (await getTrackedSeries(userId))
    .filter((s) => s.tmdbId !== null && isStale(s.lastSyncedAt, s.status))
    .slice(0, limit)
    .map((s) => s.tmdbId!);
}

const titleCard = { id: true, tmdbId: true, type: true, name: true, posterUrl: true, releaseDate: true } as const;

export function getWatchedMovies(userId: string) {
  return prisma.watchedMovie.findMany({
    where: { userId },
    orderBy: { watchedAt: "desc" },
    select: { rating: true, watchedAt: true, title: { select: titleCard } },
  });
}

export function getFavorites(userId: string) {
  return prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { title: { select: titleCard } },
  });
}

export function getWatchlist(userId: string) {
  return prisma.watchlistItem.findMany({
    where: { userId },
    orderBy: { addedAt: "desc" },
    select: { addedAt: true, title: { select: titleCard } },
  });
}

// The newest ones are plenty for a profile tab
const PROFILE_COMMENT_LIMIT = 200;

/** "Yorumlarım": each comment with where it was written ("Sherlock — S1 B3: Büyük Oyun" or the movie). */
export async function getUserComments(userId: string) {
  const comments = await prisma.comment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: PROFILE_COMMENT_LIMIT,
    select: {
      id: true,
      content: true,
      isSpoiler: true,
      createdAt: true,
      _count: { select: { likes: true } },
      title: { select: { tmdbId: true, name: true } },
      episode: {
        select: {
          episodeNumber: true,
          name: true,
          season: { select: { seasonNumber: true, title: { select: { tmdbId: true, name: true } } } },
        },
      },
    },
  });
  return comments.map((c) => {
    const ep = c.episode;
    const where = ep
      ? {
          titleName: ep.season.title.name,
          episodeLabel: `S${ep.season.seasonNumber} B${ep.episodeNumber}: ${ep.name}`,
          href: `/series/${ep.season.title.tmdbId}/season/${ep.season.seasonNumber}/episode/${ep.episodeNumber}`,
        }
      : {
          titleName: c.title?.name ?? "Silinmiş içerik",
          episodeLabel: null,
          href: c.title ? `/movie/${c.title.tmdbId}` : "/",
        };
    return {
      id: c.id,
      content: c.content,
      isSpoiler: c.isSpoiler,
      createdAt: c.createdAt.toISOString(),
      createdLabel: formatCommentTime(c.createdAt),
      likeCount: c._count.likes,
      ...where,
    };
  });
}

export type ProfileComment = Awaited<ReturnType<typeof getUserComments>>[number];

// Enough for a row on the profile
const FAVORITE_CHARACTER_LIMIT = 10;

/**
 * "En sevdiğin karakterler": the characters picked as favourite most often across the user's watched
 * episodes and movies, per series/movie, with the actor's photo from that title's cast.
 */
export async function getFavoriteCharacters(userId: string) {
  const rows = await prisma.$queryRaw<
    { titleId: string; castId: number; character: string; picks: bigint; last: Date }[]
  >`
    SELECT "titleId", "castId", MAX("character") AS character, COUNT(*) AS picks, MAX("at") AS last
    FROM (
      SELECT s."titleId", w."favoriteCastId" AS "castId", w."favoriteCharacter" AS character, w."watchedAt" AS at
      FROM "WatchedEpisode" w JOIN "Episode" e ON e."id" = w."episodeId" JOIN "Season" s ON s."id" = e."seasonId"
      WHERE w."userId" = ${userId} AND w."favoriteCastId" IS NOT NULL
      UNION ALL
      SELECT w."titleId", w."favoriteCastId", w."favoriteCharacter", w."watchedAt"
      FROM "WatchedMovie" w
      WHERE w."userId" = ${userId} AND w."favoriteCastId" IS NOT NULL
    ) picks
    GROUP BY "titleId", "castId"
    ORDER BY picks DESC, last DESC
    LIMIT ${FAVORITE_CHARACTER_LIMIT}`;
  if (rows.length === 0) return [];

  const titles = await prisma.title.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.titleId))] } },
    select: { id: true, tmdbId: true, type: true, name: true, castMembers: true },
  });
  const byId = new Map(titles.map((t) => [t.id, t]));
  return rows.flatMap((row) => {
    const title = byId.get(row.titleId);
    if (!title || title.tmdbId === null) return [];
    const actor = parseCast(title.castMembers).find((m) => m.id === row.castId);
    return [
      {
        key: `${row.titleId}-${row.castId}`,
        castId: row.castId,
        character: row.character,
        actorName: actor?.name ?? null,
        photoUrl: actor?.profileUrl ?? null,
        picks: Number(row.picks),
        title: { name: title.name, type: title.type, href: titleHref(title.type, title.tmdbId) },
      },
    ];
  });
}

export type FavoriteCharacter = Awaited<ReturnType<typeof getFavoriteCharacters>>[number];

/** The cover's character page: the picked character with the actor's photo (large) and the title's image. */
export async function getCoverCharacter(user: {
  coverCharacterTitleId: string | null;
  coverCharacterCastId: number | null;
}) {
  if (!user.coverCharacterTitleId || user.coverCharacterCastId === null) return null;
  const title = await prisma.title.findUnique({
    where: { id: user.coverCharacterTitleId },
    select: { tmdbId: true, type: true, name: true, backdropUrl: true, castMembers: true },
  });
  const member = title && parseCast(title.castMembers).find((m) => m.id === user.coverCharacterCastId);
  if (!title || title.tmdbId === null || !member) return null;
  return {
    character: characterLabel(member),
    actorName: member.name,
    // The stored w185 photo is too small for the big round icon; TMDB also has h632 of the same image
    photoUrl: member.profileUrl?.replace("/w185/", "/h632/") ?? null,
    titleName: title.name,
    from: title.type === "MOVIE" ? "filminden" : "dizisinden",
    href: titleHref(title.type, title.tmdbId),
    backdropUrl: title.backdropUrl,
  };
}
