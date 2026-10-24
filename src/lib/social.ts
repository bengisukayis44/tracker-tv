import "server-only";
import { prisma } from "@/lib/prisma";
import { buildFeed, type FeedEvent } from "@/lib/feed";

/** How far back the feed looks. */
const FEED_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Follower/following counts of a profile and whether the viewer follows it. */
export async function getFollowState(profileId: string, viewerId: string | null) {
  const [followers, following, mine] = await Promise.all([
    prisma.follow.count({ where: { followingId: profileId } }),
    prisma.follow.count({ where: { followerId: profileId } }),
    viewerId
      ? prisma.follow.findUnique({
          where: { followerId_followingId: { followerId: viewerId, followingId: profileId } },
        })
      : null,
  ]);
  return { followers, following, isFollowing: Boolean(mine) };
}

const userCard = { select: { username: true, avatarUrl: true } } as const;
const seriesOf = {
  select: {
    episodeNumber: true,
    name: true,
    season: { select: { seasonNumber: true, title: { select: { tmdbId: true, name: true, posterUrl: true } } } },
  },
} as const;
const movieOf = { select: { tmdbId: true, name: true, posterUrl: true } } as const;

/**
 * What the people the user follows watched and wrote lately, newest first. Private profiles are left out,
 * and so are personal notes (never selected).
 */
export async function getFeed(userId: string) {
  const since = new Date(Date.now() - FEED_DAYS * DAY_MS);
  const follows = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true, following: { select: { isPrivate: true } } },
  });
  // Someone who went private is still followed but shares nothing
  const ids = follows.filter((f) => !f.following.isPrivate).map((f) => f.followingId);
  if (ids.length === 0) return { following: follows.length, items: [] };

  // A watch belongs in the window if it or any of its rewatches happened in it
  const recent = {
    userId: { in: ids },
    OR: [{ watchedAt: { gte: since } }, { NOT: { rewatchedAt: { isEmpty: true } } }],
  };
  const [episodes, movies, comments] = await Promise.all([
    prisma.watchedEpisode.findMany({
      where: recent,
      select: { watchedAt: true, rewatchedAt: true, rating: true, user: userCard, episode: seriesOf },
    }),
    prisma.watchedMovie.findMany({
      where: recent,
      select: { watchedAt: true, rewatchedAt: true, rating: true, user: userCard, title: movieOf },
    }),
    prisma.comment.findMany({
      where: { userId: { in: ids }, createdAt: { gte: since } },
      select: {
        id: true,
        content: true,
        isSpoiler: true,
        createdAt: true,
        user: userCard,
        title: movieOf,
        episode: seriesOf,
      },
    }),
  ]);

  const watchDates = (w: { watchedAt: Date; rewatchedAt: Date[] }) =>
    [{ at: w.watchedAt, rewatch: false }, ...w.rewatchedAt.map((at) => ({ at, rewatch: true }))].filter(
      (d) => d.at >= since,
    );

  const events: FeedEvent[] = [
    ...episodes.flatMap((w) =>
      watchDates(w).map(({ at, rewatch }) => ({
        kind: "episode" as const,
        at,
        rewatch,
        rating: w.rating,
        user: w.user,
        series: w.episode.season.title,
        episode: {
          seasonNumber: w.episode.season.seasonNumber,
          episodeNumber: w.episode.episodeNumber,
          name: w.episode.name,
        },
      })),
    ),
    ...movies.flatMap((w) =>
      watchDates(w).map(({ at, rewatch }) => ({
        kind: "movie" as const,
        at,
        rewatch,
        rating: w.rating,
        user: w.user,
        movie: w.title,
      })),
    ),
    ...comments.map((c) => {
      const ep = c.episode;
      const where = ep
        ? {
            name: ep.season.title.name,
            detail: `S${ep.season.seasonNumber} B${ep.episodeNumber}: ${ep.name}`,
            href: `/series/${ep.season.title.tmdbId}/season/${ep.season.seasonNumber}/episode/${ep.episodeNumber}`,
            posterUrl: ep.season.title.posterUrl,
          }
        : {
            name: c.title?.name ?? "Silinmiş içerik",
            detail: null,
            href: c.title ? `/movie/${c.title.tmdbId}` : "/",
            posterUrl: c.title?.posterUrl ?? null,
          };
      return {
        kind: "comment" as const,
        at: c.createdAt,
        user: c.user,
        id: c.id,
        content: c.content,
        isSpoiler: c.isSpoiler,
        where,
      };
    }),
  ];
  return { following: follows.length, items: buildFeed(events) };
}

/** Active public users the viewer does not follow yet: most episodes and movies watched in the last 30 days. */
export async function getSuggestedUsers(viewerId: string, limit = 6) {
  const since = new Date(Date.now() - 30 * DAY_MS);
  const rows = await prisma.$queryRaw<{ id: string; username: string; avatarUrl: string | null; activity: bigint }[]>`
    SELECT u."id", u."username", u."avatarUrl", COUNT(*) AS activity
    FROM "User" u
    JOIN (
      SELECT "userId", "watchedAt" FROM "WatchedEpisode"
      UNION ALL SELECT "userId", "watchedAt" FROM "WatchedMovie"
    ) w ON w."userId" = u."id"
    WHERE w."watchedAt" >= ${since}
      AND u."isPrivate" = false
      AND u."id" <> ${viewerId}
      AND u."email" NOT LIKE '%@e2e.test'
      AND NOT EXISTS (SELECT 1 FROM "Follow" f WHERE f."followerId" = ${viewerId} AND f."followingId" = u."id")
    GROUP BY u."id"
    ORDER BY activity DESC
    LIMIT ${limit}`;
  return rows.map((r) => ({ id: r.id, username: r.username, avatarUrl: r.avatarUrl, activity: Number(r.activity) }));
}

/** Public users whose name starts with (or contains) the search text. */
export async function searchUsers(query: string, limit = 6) {
  const q = query.trim().toLowerCase().replace(/^@/, "");
  if (q.length < 2) return [];
  const users = await prisma.user.findMany({
    where: { username: { contains: q }, isPrivate: false, NOT: { email: { endsWith: "@e2e.test" } } },
    select: { username: true, avatarUrl: true },
    take: 50,
  });
  return users
    .sort(
      (a, b) =>
        Number(!a.username.startsWith(q)) - Number(!b.username.startsWith(q)) || a.username.localeCompare(b.username),
    )
    .slice(0, limit);
}

export const FOLLOW_LISTS = {
  takipciler: { label: "Takipçiler", empty: "Henüz takipçi yok." },
  "takip-edilenler": { label: "Takip edilenler", empty: "Henüz kimse takip edilmiyor." },
} as const;
export type FollowList = keyof typeof FOLLOW_LISTS;

/**
 * Who follows a profile (or whom it follows), newest follow first, with whether the viewer follows each of them.
 */
export async function getFollowList(profileId: string, list: FollowList, viewerId: string | null) {
  const follows = await prisma.follow.findMany({
    where: list === "takipciler" ? { followingId: profileId } : { followerId: profileId },
    orderBy: { createdAt: "desc" },
    select: {
      follower: { select: { id: true, username: true, avatarUrl: true, isPrivate: true } },
      following: { select: { id: true, username: true, avatarUrl: true, isPrivate: true } },
    },
  });
  const users = follows.map((f) => (list === "takipciler" ? f.follower : f.following));
  const mine = viewerId
    ? await prisma.follow.findMany({
        where: { followerId: viewerId, followingId: { in: users.map((u) => u.id) } },
        select: { followingId: true },
      })
    : [];
  const followed = new Set(mine.map((f) => f.followingId));
  return users.map((u) => ({ ...u, isFollowing: followed.has(u.id) }));
}
