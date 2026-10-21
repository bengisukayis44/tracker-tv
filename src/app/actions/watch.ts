"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { isAired } from "@/lib/episodes";
import { prisma } from "@/lib/prisma";
import { idSchema, watchEpisodeSchema, type WatchEpisodeInput } from "@/lib/validations/watch";
import { airedEpisodeIds, previousUnwatchedEpisodeIds } from "@/lib/watch";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string; needsLogin?: boolean };

const LOGIN_REQUIRED = { ok: false, error: "Bunun için giriş yapmalısın.", needsLogin: true } as const;
const NOT_FOUND = { ok: false, error: "Bölüm bulunamadı." } as const;
const NOT_AIRED = { ok: false, error: "Bu bölüm henüz yayınlanmadı." } as const;

async function findEpisode(episodeId: string) {
  return prisma.episode.findUnique({
    where: { id: episodeId },
    select: { id: true, airDate: true, season: { select: { titleId: true, title: { select: { tmdbId: true } } } } },
  });
}

function revalidateTitle(tmdbId: number | null) {
  // "layout" refreshes the series page, its season pages and every episode page under it
  if (tmdbId != null) revalidatePath(`/series/${tmdbId}`, "layout");
}

/** Watching any episode takes the title off the user's "Daha sonra izle" list (PROJE_PLANI.md §5). */
async function removeFromWatchlist(userId: string, titleId: string) {
  await prisma.watchlistItem.deleteMany({ where: { userId, titleId } });
}

async function unwatchedPreviousIds(userId: string, titleId: string, episodeId: string) {
  const [seasons, watched] = await Promise.all([
    prisma.season.findMany({
      where: { titleId },
      select: { seasonNumber: true, episodes: { select: { id: true, episodeNumber: true, airDate: true } } },
    }),
    prisma.watchedEpisode.findMany({
      where: { userId, episode: { season: { titleId } } },
      select: { episodeId: true },
    }),
  ]);
  return previousUnwatchedEpisodeIds(seasons, episodeId, new Set(watched.map((w) => w.episodeId)));
}

/**
 * Saves (or updates) "İzledim" with rating, emotions and note.
 * Returns how many earlier aired episodes are still unwatched, so the UI can offer to mark them too.
 */
export async function saveEpisodeWatch(input: WatchEpisodeInput): Promise<ActionResult<{ previousUnwatched: number }>> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;

  const parsed = watchEpisodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz bilgi." };
  const { episodeId, rating, emotions, note } = parsed.data;

  const episode = await findEpisode(episodeId);
  if (!episode) return NOT_FOUND;
  if (!isAired(episode)) return NOT_AIRED;

  const data = { rating, emotions, note };
  await prisma.watchedEpisode.upsert({
    where: { userId_episodeId: { userId: user.id, episodeId } },
    create: { userId: user.id, episodeId, ...data },
    update: data,
  });
  await removeFromWatchlist(user.id, episode.season.titleId);

  const previous = await unwatchedPreviousIds(user.id, episode.season.titleId, episodeId);
  revalidateTitle(episode.season.title.tmdbId);
  return { ok: true, previousUnwatched: previous.length };
}

/** Quick check-mark from the episode list: marks watched without touching an existing rating/note. */
export async function markEpisodeWatched(episodeId: string): Promise<ActionResult<{ previousUnwatched: number }>> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;
  if (!idSchema.safeParse(episodeId).success) return NOT_FOUND;

  const episode = await findEpisode(episodeId);
  if (!episode) return NOT_FOUND;
  if (!isAired(episode)) return NOT_AIRED;

  await prisma.watchedEpisode.upsert({
    where: { userId_episodeId: { userId: user.id, episodeId } },
    create: { userId: user.id, episodeId },
    update: {},
  });
  await removeFromWatchlist(user.id, episode.season.titleId);

  const previous = await unwatchedPreviousIds(user.id, episode.season.titleId, episodeId);
  revalidateTitle(episode.season.title.tmdbId);
  return { ok: true, previousUnwatched: previous.length };
}

/** "İzlenmedi olarak işaretle": removes the watch together with its rating, emotions and note. */
export async function unwatchEpisode(episodeId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;
  if (!idSchema.safeParse(episodeId).success) return NOT_FOUND;

  const episode = await findEpisode(episodeId);
  if (!episode) return NOT_FOUND;

  await prisma.watchedEpisode.deleteMany({ where: { userId: user.id, episodeId } });
  revalidateTitle(episode.season.title.tmdbId);
  return { ok: true };
}

/** Marks every earlier aired, unwatched episode (across seasons) as watched. */
export async function markPreviousEpisodesWatched(episodeId: string): Promise<ActionResult<{ marked: number }>> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;
  if (!idSchema.safeParse(episodeId).success) return NOT_FOUND;

  const episode = await findEpisode(episodeId);
  if (!episode) return NOT_FOUND;

  const ids = await unwatchedPreviousIds(user.id, episode.season.titleId, episodeId);
  const { count } = await prisma.watchedEpisode.createMany({
    data: ids.map((id) => ({ userId: user.id, episodeId: id })),
    skipDuplicates: true,
  });
  revalidateTitle(episode.season.title.tmdbId);
  return { ok: true, marked: count };
}

/** "Sezonun tamamını izledim" (aired episodes only) or undo it for the whole season. */
export async function setSeasonWatched(seasonId: string, watched: boolean): Promise<ActionResult<{ changed: number }>> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;
  if (!idSchema.safeParse(seasonId).success) return { ok: false, error: "Sezon bulunamadı." };

  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: {
      titleId: true,
      title: { select: { tmdbId: true } },
      episodes: { select: { id: true, episodeNumber: true, airDate: true } },
    },
  });
  if (!season) return { ok: false, error: "Sezon bulunamadı." };

  let changed: number;
  if (watched) {
    const ids = airedEpisodeIds(season.episodes);
    ({ count: changed } = await prisma.watchedEpisode.createMany({
      data: ids.map((id) => ({ userId: user.id, episodeId: id })),
      skipDuplicates: true,
    }));
    if (ids.length > 0) await removeFromWatchlist(user.id, season.titleId);
  } else {
    ({ count: changed } = await prisma.watchedEpisode.deleteMany({
      where: { userId: user.id, episodeId: { in: season.episodes.map((ep) => ep.id) } },
    }));
  }
  revalidateTitle(season.title.tmdbId);
  return { ok: true, changed };
}

async function toggleListEntry(
  titleId: string,
  list: "favorite" | "watchlist",
): Promise<ActionResult<{ active: boolean }>> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;
  if (!idSchema.safeParse(titleId).success) return { ok: false, error: "Dizi bulunamadı." };

  const title = await prisma.title.findUnique({ where: { id: titleId }, select: { tmdbId: true } });
  if (!title) return { ok: false, error: "Dizi bulunamadı." };

  const where = { userId_titleId: { userId: user.id, titleId } };
  const data = { userId: user.id, titleId };
  let active: boolean;
  if (list === "favorite") {
    active = !(await prisma.favorite.findUnique({ where }));
    await (active ? prisma.favorite.create({ data }) : prisma.favorite.delete({ where }));
  } else {
    active = !(await prisma.watchlistItem.findUnique({ where }));
    await (active ? prisma.watchlistItem.create({ data }) : prisma.watchlistItem.delete({ where }));
  }
  revalidateTitle(title.tmdbId);
  return { ok: true, active };
}

export async function toggleFavorite(titleId: string) {
  return toggleListEntry(titleId, "favorite");
}

export async function toggleWatchlist(titleId: string) {
  return toggleListEntry(titleId, "watchlist");
}
