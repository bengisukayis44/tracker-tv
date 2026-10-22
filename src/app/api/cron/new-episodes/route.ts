import { NextResponse, type NextRequest } from "next/server";
import { isStale, refreshSeries } from "@/lib/catalog";
import { newEpisodeMessages, type AiringEpisode } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import { isPushEnabled, pushToUser } from "@/lib/push";

// Refreshing series from TMDB can take a while
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Running series refreshed per run so new air dates are known; the rest refresh when someone visits them
const REFRESH_LIMIT = 15;

const todayInTurkey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());

/**
 * Daily (vercel.json cron): tells everyone who turned notifications on which of the series they follow
 * (watched something of, or put on the watch-later list) have an episode airing today.
 * Vercel calls it with `Authorization: Bearer $CRON_SECRET`.
 * `?dryRun=1` (tests) only returns what would be sent, without refreshing or sending; `&userId=` limits it to one user.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const params = request.nextUrl.searchParams;
  const dryRun = params.get("dryRun") === "1";
  const onlyUser = params.get("userId");
  if (!isPushEnabled()) return NextResponse.json({ skipped: "push kapalı" });

  const users = await prisma.pushSubscription.findMany({
    where: onlyUser ? { userId: onlyUser } : undefined,
    distinct: ["userId"],
    select: { userId: true },
  });
  const userIds = users.map((u) => u.userId);
  if (userIds.length === 0) return NextResponse.json({ users: 0, sent: 0 });

  // Followed series per user
  const [watched, listed] = await Promise.all([
    prisma.$queryRaw<{ userId: string; titleId: string }[]>`
      SELECT DISTINCT w."userId", s."titleId"
      FROM "WatchedEpisode" w JOIN "Episode" e ON e."id" = w."episodeId" JOIN "Season" s ON s."id" = e."seasonId"
      WHERE w."userId" = ANY(${userIds}::text[])`,
    prisma.watchlistItem.findMany({
      where: { userId: { in: userIds }, title: { type: "SERIES" } },
      select: { userId: true, titleId: true },
    }),
  ]);
  const trackedByUser = new Map<string, Set<string>>();
  for (const { userId, titleId } of [...watched, ...listed]) {
    trackedByUser.set(userId, (trackedByUser.get(userId) ?? new Set()).add(titleId));
  }
  const titleIds = [...new Set([...trackedByUser.values()].flatMap((set) => [...set]))];

  // Bring running series up to date first, so today's episodes are in the database
  const titles = await prisma.title.findMany({
    where: { id: { in: titleIds } },
    select: { tmdbId: true, status: true, lastSyncedAt: true },
  });
  const toRefresh = titles
    .filter((t) => t.tmdbId !== null && t.tmdbId > 0 && isStale(t.lastSyncedAt, t.status))
    .slice(0, dryRun ? 0 : REFRESH_LIMIT);
  for (let i = 0; i < toRefresh.length; i += 3) {
    await Promise.all(toRefresh.slice(i, i + 3).map((t) => refreshSeries(t.tmdbId!)));
  }

  // Air dates are midnight UTC of the day; a range also catches any stored with a time
  const today = new Date(`${todayInTurkey()}T00:00:00Z`);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const episodes = await prisma.episode.findMany({
    where: {
      airDate: { gte: today, lt: tomorrow },
      season: { titleId: { in: titleIds }, seasonNumber: { not: 0 } },
    },
    select: {
      episodeNumber: true,
      name: true,
      season: {
        select: { seasonNumber: true, title: { select: { id: true, name: true, tmdbId: true, posterUrl: true } } },
      },
    },
  });
  const airing: AiringEpisode[] = episodes.map((e) => ({
    titleId: e.season.title.id,
    seriesName: e.season.title.name,
    tmdbId: e.season.title.tmdbId,
    posterUrl: e.season.title.posterUrl,
    seasonNumber: e.season.seasonNumber,
    episodeNumber: e.episodeNumber,
    name: e.name,
  }));

  const planned = newEpisodeMessages(trackedByUser, airing);
  if (dryRun) return NextResponse.json({ users: userIds.length, planned: Object.fromEntries(planned) });

  let sent = 0;
  for (const [userId, messages] of planned) {
    sent += await pushToUser(userId, messages);
  }
  return NextResponse.json({ users: userIds.length, refreshed: toRefresh.length, airing: airing.length, sent });
}
