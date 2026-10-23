import "server-only";
import { prisma } from "@/lib/prisma";

const titleCard = { id: true, tmdbId: true, type: true, name: true, posterUrl: true, releaseDate: true } as const;

/** A user's lists for the profile: the viewer sees private ones only on their own profile. */
export async function getUserLists(userId: string, includePrivate: boolean) {
  const lists = await prisma.list.findMany({
    where: { userId, ...(includePrivate ? {} : { isPublic: true }) },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      isPublic: true,
      _count: { select: { items: true } },
      // The first four posters make the list's cover
      items: { orderBy: { addedAt: "desc" }, take: 4, select: { title: { select: { posterUrl: true } } } },
    },
  });
  return lists.map((l) => ({
    id: l.id,
    name: l.name,
    description: l.description,
    isPublic: l.isPublic,
    count: l._count.items,
    posters: l.items.map((i) => i.title.posterUrl),
  }));
}

export type ListSummary = Awaited<ReturnType<typeof getUserLists>>[number];

/**
 * A list page's data, or null if the viewer may not see it: a private list (or any list of a private profile)
 * is visible only to its owner.
 */
export async function getList(listId: string, viewerId: string | null) {
  const list = await prisma.list.findUnique({
    where: { id: listId },
    select: {
      id: true,
      name: true,
      description: true,
      isPublic: true,
      updatedAt: true,
      user: { select: { id: true, username: true, avatarUrl: true, isPrivate: true } },
      items: { orderBy: { addedAt: "desc" }, select: { addedAt: true, title: { select: titleCard } } },
    },
  });
  if (!list) return null;
  const isOwner = list.user.id === viewerId;
  if (!isOwner && (!list.isPublic || list.user.isPrivate)) return null;
  return { ...list, isOwner };
}
