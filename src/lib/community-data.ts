import "server-only";
import { prisma } from "@/lib/prisma";
import { summarizeCommunity } from "@/lib/community";

const select = { rating: true, emotions: true, favoriteCastId: true, favoriteCharacter: true } as const;

/** Everyone's watches of an episode or movie, summed up (notes are not read). */
export async function getCommunityStats(
  target: { kind: "episode"; episodeId: string } | { kind: "movie"; titleId: string },
) {
  const rows =
    target.kind === "episode"
      ? await prisma.watchedEpisode.findMany({ where: { episodeId: target.episodeId }, select })
      : await prisma.watchedMovie.findMany({ where: { titleId: target.titleId }, select });
  return summarizeCommunity(rows);
}
