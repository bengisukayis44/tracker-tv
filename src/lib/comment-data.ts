import "server-only";
import { prisma } from "@/lib/prisma";
import { formatCommentTime, isEdited, type CommentView } from "@/lib/comments";
import type { CommentTarget } from "@/lib/validations/comment";

// Plenty for one episode or movie; the newest are kept if there are ever more
const COMMENT_LIMIT = 500;

/** Comments of an episode or movie with like counts and what the viewer (if any) may do with them. */
export async function getComments(target: CommentTarget, viewerId: string | null): Promise<CommentView[]> {
  const comments = await prisma.comment.findMany({
    where: target.kind === "episode" ? { episodeId: target.episodeId } : { titleId: target.titleId },
    orderBy: { createdAt: "desc" },
    take: COMMENT_LIMIT,
    select: {
      id: true,
      userId: true,
      content: true,
      isSpoiler: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { username: true, avatarUrl: true } },
      _count: { select: { likes: true } },
      likes: viewerId ? { where: { userId: viewerId }, select: { userId: true } } : false,
    },
  });
  return comments.map((c) => ({
    id: c.id,
    content: c.content,
    isSpoiler: c.isSpoiler,
    createdAt: c.createdAt.toISOString(),
    createdLabel: formatCommentTime(c.createdAt),
    edited: isEdited(c.createdAt, c.updatedAt),
    author: c.user,
    likeCount: c._count.likes,
    likedByMe: Boolean(c.likes?.length),
    mine: c.userId === viewerId,
  }));
}

/** "En çok konuşulanlar": episodes and movies with the most comments in the last `days` days. */
export async function getMostDiscussed(days = 30, limit = 6) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const groups = await prisma.comment.groupBy({
    by: ["episodeId", "titleId"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
    orderBy: { _count: { id: "desc" } },
    take: limit,
  });
  const episodeIds = groups.flatMap((g) => (g.episodeId ? [g.episodeId] : []));
  const titleIds = groups.flatMap((g) => (g.titleId ? [g.titleId] : []));
  const [episodes, movies] = await Promise.all([
    prisma.episode.findMany({
      where: { id: { in: episodeIds } },
      select: {
        id: true,
        episodeNumber: true,
        name: true,
        season: { select: { seasonNumber: true, title: { select: { tmdbId: true, name: true, posterUrl: true } } } },
      },
    }),
    prisma.title.findMany({
      where: { id: { in: titleIds } },
      select: { id: true, tmdbId: true, name: true, posterUrl: true },
    }),
  ]);
  return groups.flatMap((g) => {
    const comments = g._count._all;
    if (g.episodeId) {
      const ep = episodes.find((e) => e.id === g.episodeId);
      if (!ep) return [];
      const { seasonNumber, title } = ep.season;
      return [
        {
          key: ep.id,
          href: `/series/${title.tmdbId}/season/${seasonNumber}/episode/${ep.episodeNumber}`,
          name: title.name,
          detail: `S${seasonNumber} B${ep.episodeNumber}: ${ep.name}`,
          posterUrl: title.posterUrl,
          comments,
        },
      ];
    }
    const movie = movies.find((m) => m.id === g.titleId);
    return movie
      ? [
          {
            key: movie.id,
            href: `/movie/${movie.tmdbId}`,
            name: movie.name,
            detail: "Film",
            posterUrl: movie.posterUrl,
            comments,
          },
        ]
      : [];
  });
}

export type DiscussedItem = Awaited<ReturnType<typeof getMostDiscussed>>[number];
