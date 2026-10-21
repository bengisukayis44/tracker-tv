import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { formatCommentTime } from "@/lib/comments";
import { nextEpisode, watchProgress } from "@/lib/watch";

/**
 * Data for the profile page (PROJE_PLANI.md §4.7) and the watch lists (§4.8).
 * Everything here is public except personal notes, which are never selected.
 */

export const getProfileUser = cache((username: string) =>
  prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, avatarUrl: true, createdAt: true },
  }),
);

/** Total minutes and counts. Episodes without a runtime count with the series' average episode length. */
export async function getWatchStats(userId: string) {
  const [[episodes], [movies]] = await Promise.all([
    prisma.$queryRaw<{ minutes: bigint; count: bigint }[]>`
      SELECT COALESCE(SUM(COALESCE(e."runtime", t."runtime", 0)), 0) AS minutes, COUNT(*) AS count
      FROM "WatchedEpisode" w
      JOIN "Episode" e ON e."id" = w."episodeId"
      JOIN "Season" s ON s."id" = e."seasonId"
      JOIN "Title" t ON t."id" = s."titleId"
      WHERE w."userId" = ${userId}`,
    prisma.$queryRaw<{ minutes: bigint; count: bigint }[]>`
      SELECT COALESCE(SUM(COALESCE(t."runtime", 0)), 0) AS minutes, COUNT(*) AS count
      FROM "WatchedMovie" w
      JOIN "Title" t ON t."id" = w."titleId"
      WHERE w."userId" = ${userId}`,
  ]);
  return {
    seriesMinutes: Number(episodes.minutes),
    episodeCount: Number(episodes.count),
    movieMinutes: Number(movies.minutes),
    movieCount: Number(movies.count),
  };
}

export type EpisodeLink = { seasonNumber: number; episodeNumber: number; name: string; episodeId: string };

/**
 * Every series the user has watched something of: progress, where they left off and what comes next,
 * most recently watched first.
 */
export async function getSeriesProgress(userId: string) {
  const watched = await prisma.watchedEpisode.findMany({
    where: { userId },
    select: { episodeId: true, watchedAt: true, episode: { select: { season: { select: { titleId: true } } } } },
  });
  if (watched.length === 0) return [];

  const lastWatchedAt = new Map<string, Date>();
  for (const w of watched) {
    const titleId = w.episode.season.titleId;
    const prev = lastWatchedAt.get(titleId);
    if (!prev || w.watchedAt > prev) lastWatchedAt.set(titleId, w.watchedAt);
  }
  const watchedIds = new Set(watched.map((w) => w.episodeId));

  const titles = await prisma.title.findMany({
    where: { id: { in: [...lastWatchedAt.keys()] } },
    select: {
      id: true,
      tmdbId: true,
      name: true,
      posterUrl: true,
      seasons: {
        select: {
          seasonNumber: true,
          episodes: { select: { id: true, episodeNumber: true, name: true, airDate: true } },
        },
      },
    },
  });

  type Item = { seasonNumber: number; episode: { id: string; episodeNumber: number; name: string } } | null;
  const toLink = (item: Item): EpisodeLink | null =>
    item && {
      seasonNumber: item.seasonNumber,
      episodeNumber: item.episode.episodeNumber,
      name: item.episode.name,
      episodeId: item.episode.id,
    };

  return titles
    .map((title) => {
      const { last, next } = nextEpisode(title.seasons, watchedIds);
      return {
        id: title.id,
        tmdbId: title.tmdbId,
        name: title.name,
        posterUrl: title.posterUrl,
        progress: watchProgress(title.seasons, watchedIds),
        lastWatchedAt: lastWatchedAt.get(title.id)!,
        last: toLink(last),
        next: toLink(next),
      };
    })
    .sort((a, b) => b.lastWatchedAt.getTime() - a.lastWatchedAt.getTime());
}

export type SeriesProgress = Awaited<ReturnType<typeof getSeriesProgress>>[number];

/** "İzlemeye devam et": started series with an aired episode still to watch. */
export async function getContinueWatching(userId: string) {
  return (await getSeriesProgress(userId)).filter(
    (s): s is SeriesProgress & { next: EpisodeLink } => s.next !== null,
  );
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
      : { titleName: c.title?.name ?? "Silinmiş içerik", episodeLabel: null, href: c.title ? `/movie/${c.title.tmdbId}` : "/" };
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
