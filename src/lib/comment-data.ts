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
