import "server-only";
import { prisma } from "@/lib/prisma";

/** What the signed-in user has done with one title: watched episodes, favorite, watch-later. */
export async function getTitleViewerState(userId: string, titleId: string) {
  const [watched, favorite, watchlist] = await Promise.all([
    prisma.watchedEpisode.findMany({
      where: { userId, episode: { season: { titleId } } },
      select: { episodeId: true },
    }),
    prisma.favorite.findUnique({ where: { userId_titleId: { userId, titleId } }, select: { titleId: true } }),
    prisma.watchlistItem.findUnique({ where: { userId_titleId: { userId, titleId } }, select: { titleId: true } }),
  ]);
  return {
    watchedIds: new Set(watched.map((w) => w.episodeId)),
    isFavorite: Boolean(favorite),
    inWatchlist: Boolean(watchlist),
  };
}

export type TitleViewerState = Awaited<ReturnType<typeof getTitleViewerState>>;

const watchSelect = {
  rating: true,
  emotions: true,
  note: true,
  favoriteCastId: true,
  favoriteCharacter: true,
  watchedAt: true,
} as const;

export function getEpisodeWatch(userId: string, episodeId: string) {
  return prisma.watchedEpisode.findUnique({
    where: { userId_episodeId: { userId, episodeId } },
    select: watchSelect,
  });
}

export function getMovieWatch(userId: string, titleId: string) {
  return prisma.watchedMovie.findUnique({
    where: { userId_titleId: { userId, titleId } },
    select: watchSelect,
  });
}
