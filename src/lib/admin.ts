import "server-only";
import { Prisma, type ReportReason } from "@/generated/prisma/client";
import { formatCommentTime } from "@/lib/comments";
import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Test accounts are left out of every number and list in the panel. */
const realUser = { NOT: { email: { endsWith: "@e2e.test" } } } as const;
const TEST_EMAIL = "%@e2e.test";

export const REPORT_REASONS: Record<ReportReason, string> = {
  SPOILER: "İşaretlenmemiş spoiler",
  ABUSE: "Hakaret veya taciz",
  SPAM: "Reklam veya alakasız",
  OTHER: "Diğer",
};

/** "2026-10-24" in Turkish time, for grouping by day. */
function istanbulDay(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(date);
}

/** The last `days` days, oldest first, each with how many of `dates` fell on it. */
export function countByDay(dates: Date[], days: number, now = new Date()) {
  const counts = new Map<string, number>();
  for (const d of dates) counts.set(istanbulDay(d), (counts.get(istanbulDay(d)) ?? 0) + 1);
  return Array.from({ length: days }, (_, i) => {
    const day = istanbulDay(new Date(now.getTime() - (days - 1 - i) * DAY_MS));
    return { day, count: counts.get(day) ?? 0 };
  });
}

/** People who watched or commented since `since`. */
async function activeSince(since: Date) {
  const [row] = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(DISTINCT a."userId") AS count FROM (
      SELECT "userId" FROM "WatchedEpisode" WHERE "watchedAt" >= ${since}
      UNION ALL SELECT "userId" FROM "WatchedMovie" WHERE "watchedAt" >= ${since}
      UNION ALL SELECT "userId" FROM "Comment" WHERE "createdAt" >= ${since}
    ) a JOIN "User" u ON u."id" = a."userId"
    WHERE u."email" NOT LIKE ${TEST_EMAIL}`;
  return Number(row.count);
}

/** The overview page: members, activity, totals and this week's most watched. */
export async function getAdminOverview(now = new Date()) {
  const week = new Date(now.getTime() - 7 * DAY_MS);
  const month = new Date(now.getTime() - 30 * DAY_MS);
  const real = { user: realUser };

  const [
    users,
    newWeek,
    newMonth,
    activeWeek,
    activeMonth,
    suspended,
    episodes,
    movies,
    comments,
    openReports,
    signups,
    watches,
    topSeries,
    topMovies,
  ] = await Promise.all([
    prisma.user.count({ where: realUser }),
    prisma.user.count({ where: { ...realUser, createdAt: { gte: week } } }),
    prisma.user.count({ where: { ...realUser, createdAt: { gte: month } } }),
    activeSince(week),
    activeSince(month),
    prisma.user.count({ where: { ...realUser, suspendedAt: { not: null } } }),
    prisma.watchedEpisode.count({ where: real }),
    prisma.watchedMovie.count({ where: real }),
    prisma.comment.count({ where: real }),
    prisma.comment.count({ where: { reports: { some: { resolvedAt: null } } } }),
    prisma.user.findMany({ where: { ...realUser, createdAt: { gte: month } }, select: { createdAt: true } }),
    prisma.$queryRaw<{ at: Date }[]>`
      SELECT w."watchedAt" AS at FROM (
        SELECT "userId", "watchedAt" FROM "WatchedEpisode" UNION ALL SELECT "userId", "watchedAt" FROM "WatchedMovie"
      ) w JOIN "User" u ON u."id" = w."userId"
      WHERE w."watchedAt" >= ${month} AND u."email" NOT LIKE ${TEST_EMAIL}`,
    prisma.$queryRaw<{ tmdbId: number; name: string; episodes: bigint; people: bigint }[]>`
      SELECT t."tmdbId", t."name", COUNT(*) AS episodes, COUNT(DISTINCT w."userId") AS people
      FROM "WatchedEpisode" w
      JOIN "User" u ON u."id" = w."userId"
      JOIN "Episode" e ON e."id" = w."episodeId"
      JOIN "Season" s ON s."id" = e."seasonId"
      JOIN "Title" t ON t."id" = s."titleId"
      WHERE w."watchedAt" >= ${week} AND u."email" NOT LIKE ${TEST_EMAIL}
      GROUP BY t."id" ORDER BY people DESC, episodes DESC LIMIT 5`,
    prisma.$queryRaw<{ tmdbId: number; name: string; people: bigint }[]>`
      SELECT t."tmdbId", t."name", COUNT(*) AS people
      FROM "WatchedMovie" w
      JOIN "User" u ON u."id" = w."userId"
      JOIN "Title" t ON t."id" = w."titleId"
      WHERE w."watchedAt" >= ${week} AND u."email" NOT LIKE ${TEST_EMAIL}
      GROUP BY t."id" ORDER BY people DESC LIMIT 5`,
  ]);

  return {
    users,
    newWeek,
    newMonth,
    activeWeek,
    activeMonth,
    suspended,
    episodes,
    movies,
    comments,
    openReports,
    signupsByDay: countByDay(
      signups.map((s) => s.createdAt),
      30,
      now,
    ),
    watchesByDay: countByDay(
      watches.map((w) => w.at),
      30,
      now,
    ),
    topSeries: topSeries.map((t) => ({
      tmdbId: t.tmdbId,
      name: t.name,
      episodes: Number(t.episodes),
      people: Number(t.people),
    })),
    topMovies: topMovies.map((t) => ({ tmdbId: t.tmdbId, name: t.name, people: Number(t.people) })),
  };
}

export const ADMIN_USERS_PAGE = 50;

/** Members, newest first, optionally matching a name or e-mail. */
export async function getAdminUsers(query: string, page: number) {
  const q = query.trim().toLowerCase().replace(/^@/, "");
  const where: Prisma.UserWhereInput = {
    ...realUser,
    ...(q && { OR: [{ username: { contains: q } }, { email: { contains: q } }] }),
  };
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ADMIN_USERS_PAGE,
      take: ADMIN_USERS_PAGE,
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        isAdmin: true,
        isPrivate: true,
        suspendedAt: true,
        createdAt: true,
        _count: { select: { watchedEpisodes: true, watchedMovies: true, comments: true } },
      },
    }),
  ]);
  return { total, users };
}

/** One member in detail, with their latest comments and the reports against them. */
export async function getAdminUser(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      email: true,
      avatarUrl: true,
      isAdmin: true,
      isPrivate: true,
      suspendedAt: true,
      createdAt: true,
      _count: {
        select: {
          watchedEpisodes: true,
          watchedMovies: true,
          comments: true,
          followers: true,
          following: true,
          lists: true,
        },
      },
    },
  });
  if (!user) return null;
  const [lastWatch, reportsAgainst, comments] = await Promise.all([
    prisma.$queryRaw<{ at: Date | null }[]>`
      SELECT MAX(at) AS at FROM (
        SELECT MAX("watchedAt") AS at FROM "WatchedEpisode" WHERE "userId" = ${id}
        UNION ALL SELECT MAX("watchedAt") FROM "WatchedMovie" WHERE "userId" = ${id}
      ) w`,
    prisma.commentReport.count({ where: { comment: { userId: id } } }),
    getAdminComments({ userId: id }, 20),
  ]);
  return { ...user, lastWatchAt: lastWatch[0]?.at ?? null, reportsAgainst, comments };
}

/** A comment as the panel shows it: where it is, who wrote it and why it was reported. */
export type AdminComment = Awaited<ReturnType<typeof getAdminComments>>[number];

/** Comments, newest first; with `reported`, only those with open reports, most reported first. */
export async function getAdminComments(where: Prisma.CommentWhereInput, take: number, reported = false) {
  const comments = await prisma.comment.findMany({
    where: reported ? { ...where, reports: { some: { resolvedAt: null } } } : where,
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      content: true,
      isSpoiler: true,
      createdAt: true,
      parentId: true,
      user: { select: { id: true, username: true } },
      title: { select: { tmdbId: true, name: true } },
      episode: {
        select: {
          episodeNumber: true,
          season: { select: { seasonNumber: true, title: { select: { tmdbId: true, name: true } } } },
        },
      },
      reports: { where: { resolvedAt: null }, select: { reason: true } },
    },
  });
  const views = comments.map((c) => {
    const ep = c.episode;
    const where = ep
      ? {
          label: `${ep.season.title.name} · S${ep.season.seasonNumber} B${ep.episodeNumber}`,
          href: `/series/${ep.season.title.tmdbId}/season/${ep.season.seasonNumber}/episode/${ep.episodeNumber}#yorum-${c.parentId ?? c.id}`,
        }
      : {
          label: c.title?.name ?? "Silinmiş içerik",
          href: c.title ? `/movie/${c.title.tmdbId}#yorum-${c.parentId ?? c.id}` : null,
        };
    const reasons = new Map<ReportReason, number>();
    for (const r of c.reports) reasons.set(r.reason, (reasons.get(r.reason) ?? 0) + 1);
    return {
      id: c.id,
      content: c.content,
      isSpoiler: c.isSpoiler,
      isReply: c.parentId !== null,
      createdLabel: formatCommentTime(c.createdAt),
      author: c.user,
      where,
      reportCount: c.reports.length,
      reasons: [...reasons].map(([reason, count]) => ({ label: REPORT_REASONS[reason], count })),
    };
  });
  return reported ? views.sort((a, b) => b.reportCount - a.reportCount) : views;
}
