"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { parseCast, type CastMember } from "@/lib/cast";
import { imagePathOf, isImagePath, orderCoverImages } from "@/lib/cover";
import { episodeCode } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { tmdb } from "@/lib/tmdb";
import type { ActionResult } from "./watch";

const LOGIN_REQUIRED = { ok: false, error: "Bunun için giriş yapmalısın.", needsLogin: true } as const;
const titleSchema = z.object({ type: z.enum(["SERIES", "MOVIE"]), tmdbId: z.number().int().positive() });
type TitleInput = z.infer<typeof titleSchema>;

export type CoverTitle = TitleInput & { name: string; posterUrl: string | null };

/** Series and movies the user has watched, most recent first: the cover is picked from these. */
export async function getCoverTitles(): Promise<ActionResult<{ titles: CoverTitle[] }>> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;
  const titles = await watchedTitles(user.id);
  return { ok: true, titles: titles.map(({ type, tmdbId, name, posterUrl }) => ({ type, tmdbId, name, posterUrl })) };
}

/** Watched series and movies with when they were last watched, most recent first. */
async function watchedTitles(userId: string) {
  const [series, movies] = await Promise.all([
    prisma.$queryRaw<{ tmdbId: number; name: string; posterUrl: string | null; last: Date }[]>`
      SELECT t."tmdbId", t."name", t."posterUrl", MAX(w."watchedAt") AS last
      FROM "WatchedEpisode" w JOIN "Episode" e ON e."id" = w."episodeId"
      JOIN "Season" s ON s."id" = e."seasonId" JOIN "Title" t ON t."id" = s."titleId"
      WHERE w."userId" = ${userId} AND t."tmdbId" > 0
      GROUP BY t."id"`,
    prisma.watchedMovie.findMany({
      where: { userId, title: { tmdbId: { gt: 0 } } },
      select: { watchedAt: true, title: { select: { tmdbId: true, name: true, posterUrl: true } } },
    }),
  ]);
  const titles = [
    ...series.map((s) => ({
      type: "SERIES" as const,
      tmdbId: s.tmdbId,
      name: s.name,
      posterUrl: s.posterUrl,
      last: s.last,
    })),
    ...movies.map((m) => ({
      type: "MOVIE" as const,
      tmdbId: m.title.tmdbId!,
      name: m.title.name,
      posterUrl: m.title.posterUrl,
      last: m.watchedAt,
    })),
  ];
  return titles.sort((a, b) => b.last.getTime() - a.last.getTime());
}

/** Did the user watch this (an episode of the series, or the movie)? Only those can be the cover. */
async function hasWatched(userId: string, { type, tmdbId }: TitleInput) {
  const where =
    type === "SERIES"
      ? prisma.watchedEpisode.findFirst({ where: { userId, episode: { season: { title: { tmdbId, type } } } } })
      : prisma.watchedMovie.findFirst({ where: { userId, title: { tmdbId, type } } });
  return Boolean(await where);
}

/** All wide images TMDB has for the title, best first. */
async function scenesOf({ type, tmdbId }: TitleInput) {
  return orderCoverImages(await tmdb.backdrops(type === "SERIES" ? "tv" : "movie", tmdbId, { timeoutMs: 8_000 }));
}

export type EpisodeStill = { path: string; label: string };

/** One still per episode of a series, in viewing order (specials last), from the stored episodes. */
async function stillsOf({ type, tmdbId }: TitleInput): Promise<EpisodeStill[]> {
  if (type !== "SERIES") return [];
  const episodes = await prisma.episode.findMany({
    where: { season: { title: { tmdbId, type } }, stillUrl: { not: null } },
    select: { episodeNumber: true, name: true, stillUrl: true, season: { select: { seasonNumber: true } } },
  });
  const order = (n: number) => (n === 0 ? Number.MAX_SAFE_INTEGER : n);
  return episodes
    .sort((a, b) => order(a.season.seasonNumber) - order(b.season.seasonNumber) || a.episodeNumber - b.episodeNumber)
    .flatMap((e) => {
      const path = imagePathOf(e.stillUrl);
      return path ? [{ path, label: `${episodeCode(e.season.seasonNumber, e.episodeNumber)} · ${e.name}` }] : [];
    });
}

/** Every wide image of a watched series or movie, and (for a series) one still per episode. */
export async function getCoverImages(
  input: TitleInput,
): Promise<ActionResult<{ scenes: string[]; stills: EpisodeStill[] }>> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;
  const parsed = titleSchema.safeParse(input);
  if (!parsed.success || !(await hasWatched(user.id, parsed.data))) {
    return { ok: false, error: "Kapak yalnızca izlediğin dizi ve filmlerden seçilebilir." };
  }
  try {
    const [scenes, stills] = await Promise.all([scenesOf(parsed.data), stillsOf(parsed.data)]);
    return { ok: true, scenes, stills };
  } catch (error) {
    console.error("Kapak görselleri alınamadı:", error);
    return { ok: false, error: "Görseller şu an yüklenemedi. Biraz sonra tekrar dene." };
  }
}

/** Saves one of the offered images as the profile cover. */
export async function setCover(input: TitleInput & { path: string }): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;
  const parsed = titleSchema.safeParse(input);
  if (!parsed.success || !isImagePath(input.path) || !(await hasWatched(user.id, parsed.data))) {
    return { ok: false, error: "Bu görsel kapak yapılamaz." };
  }
  try {
    // Only an episode still of that series, or an image TMDB actually lists for it
    const isStill = (await stillsOf(parsed.data)).some((s) => s.path === input.path);
    if (!isStill && !(await scenesOf(parsed.data)).includes(input.path)) {
      return { ok: false, error: "Bu görsel kapak yapılamaz." };
    }
  } catch {
    return { ok: false, error: "Görseller şu an doğrulanamadı. Biraz sonra tekrar dene." };
  }
  // A new image starts centred
  await prisma.user.update({ where: { id: user.id }, data: { coverPath: input.path, coverPositionY: 50 } });
  revalidatePath(`/profile/${user.username}`);
  return { ok: true };
}

/** "Konumu ayarla": which part of the cover shows, 0 (top) to 100 (bottom). */
export async function setCoverPosition(positionY: number): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;
  const parsed = z.number().min(0).max(100).safeParse(positionY);
  if (!parsed.success) return { ok: false, error: "Geçersiz konum." };
  await prisma.user.update({ where: { id: user.id }, data: { coverPositionY: Math.round(parsed.data) } });
  revalidatePath(`/profile/${user.username}`);
  return { ok: true };
}

export async function removeCover(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;
  await prisma.user.update({ where: { id: user.id }, data: { coverPath: null } });
  revalidatePath(`/profile/${user.username}`);
  return { ok: true };
}

// ---------- Cover character (the cover's second page) ----------

/** Watched series and movies, then those on the watch-later list: the cover character is picked from these. */
export async function getCharacterTitles(): Promise<ActionResult<{ titles: CoverTitle[] }>> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;
  const [watched, listed] = await Promise.all([
    watchedTitles(user.id),
    prisma.watchlistItem.findMany({
      where: { userId: user.id, title: { tmdbId: { gt: 0 } } },
      orderBy: { addedAt: "desc" },
      select: { title: { select: { type: true, tmdbId: true, name: true, posterUrl: true } } },
    }),
  ]);
  const seen = new Set<string>();
  const titles = [
    ...watched,
    ...listed.map(({ title }) => ({
      type: title.type,
      tmdbId: title.tmdbId!,
      name: title.name,
      posterUrl: title.posterUrl,
    })),
  ]
    .filter((t) => !seen.has(`${t.type}-${t.tmdbId}`) && seen.add(`${t.type}-${t.tmdbId}`))
    .map(({ type, tmdbId, name, posterUrl }) => ({ type, tmdbId, name, posterUrl }));
  return { ok: true, titles };
}

/** The title if the user watched it or has it on the watch-later list. */
async function titleOnLists(userId: string, input: TitleInput) {
  const title = await prisma.title.findFirst({
    where: { tmdbId: input.tmdbId, type: input.type },
    select: { id: true, castMembers: true },
  });
  if (!title) return null;
  const listed = await prisma.watchlistItem.findUnique({ where: { userId_titleId: { userId, titleId: title.id } } });
  return listed || (await hasWatched(userId, input)) ? title : null;
}

const NOT_ON_LISTS = { ok: false, error: "Karakter yalnızca listendeki dizi ve filmlerden seçilebilir." } as const;

/** The cast of a series or movie on the user's lists, to pick the cover character from. */
export async function getCharacterChoices(input: TitleInput): Promise<ActionResult<{ cast: CastMember[] }>> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;
  const parsed = titleSchema.safeParse(input);
  const title = parsed.success ? await titleOnLists(user.id, parsed.data) : null;
  if (!title) return NOT_ON_LISTS;
  return { ok: true, cast: parseCast(title.castMembers) };
}

export async function setCoverCharacter(input: TitleInput & { castId: number }): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;
  const parsed = titleSchema.safeParse(input);
  const title = parsed.success ? await titleOnLists(user.id, parsed.data) : null;
  if (!title) return NOT_ON_LISTS;
  if (!parseCast(title.castMembers).some((m) => m.id === input.castId)) {
    return { ok: false, error: "Bu karakter oyuncu kadrosunda yok." };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { coverCharacterTitleId: title.id, coverCharacterCastId: input.castId },
  });
  revalidatePath(`/profile/${user.username}`);
  return { ok: true };
}

export async function removeCoverCharacter(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;
  await prisma.user.update({
    where: { id: user.id },
    data: { coverCharacterTitleId: null, coverCharacterCastId: null },
  });
  revalidatePath(`/profile/${user.username}`);
  return { ok: true };
}
