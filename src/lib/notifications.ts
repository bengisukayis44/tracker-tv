import "server-only";
import { cache } from "react";
import type { NotificationType } from "@/generated/prisma/enums";
import { formatCommentTime } from "@/lib/comments";
import { prisma } from "@/lib/prisma";

/** Tells `userId` that `actorId` did something; nothing when people act on their own things. */
export async function notify(userId: string, actorId: string, type: NotificationType, commentId?: string) {
  if (userId === actorId) return;
  // One notification per like/follow: liking again after unliking does not pile them up
  if (type !== "REPLY") await unnotify(userId, actorId, type, commentId);
  await prisma.notification.create({ data: { userId, actorId, type, commentId } });
}

/** Takes a like/follow notification back when the like or follow is undone. */
export async function unnotify(userId: string, actorId: string, type: NotificationType, commentId?: string) {
  await prisma.notification.deleteMany({ where: { userId, actorId, type, commentId: commentId ?? null } });
}

/** For the bell in the header; deduplicated per request. */
export const getUnreadCount = cache((userId: string) => prisma.notification.count({ where: { userId, readAt: null } }));

const NOTIFICATION_LIMIT = 50;

/** The newest notifications, with who did it and where it happened. */
export async function getNotifications(userId: string) {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: NOTIFICATION_LIMIT,
    select: {
      id: true,
      type: true,
      createdAt: true,
      readAt: true,
      actor: { select: { username: true, avatarUrl: true } },
      comment: {
        select: {
          id: true,
          content: true,
          isSpoiler: true,
          parentId: true,
          title: { select: { tmdbId: true, name: true } },
          episode: {
            select: {
              episodeNumber: true,
              season: { select: { seasonNumber: true, title: { select: { tmdbId: true, name: true } } } },
            },
          },
        },
      },
    },
  });
  return rows.map((n) => {
    const c = n.comment;
    const ep = c?.episode;
    const where = ep
      ? {
          name: `${ep.season.title.name} S${ep.season.seasonNumber} B${ep.episodeNumber}`,
          href: `/series/${ep.season.title.tmdbId}/season/${ep.season.seasonNumber}/episode/${ep.episodeNumber}`,
        }
      : c?.title
        ? { name: c.title.name, href: `/movie/${c.title.tmdbId}` }
        : null;
    return {
      id: n.id,
      type: n.type,
      unread: n.readAt === null,
      createdLabel: formatCommentTime(n.createdAt),
      actor: n.actor,
      // Spoilers are not repeated in notifications
      snippet: c ? (c.isSpoiler ? "(spoiler)" : c.content.slice(0, 120)) : null,
      // A reply opens right at the conversation
      href:
        n.type === "FOLLOW"
          ? `/profile/${n.actor.username}`
          : where
            ? `${where.href}#yorum-${c!.parentId ?? c!.id}`
            : "/",
      where: where?.name ?? null,
    };
  });
}

export type NotificationView = Awaited<ReturnType<typeof getNotifications>>[number];
