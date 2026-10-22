"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
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
  const [series, movies] = await Promise.all([
    prisma.$queryRaw<{ tmdbId: number; name: string; posterUrl: string | null; last: Date }[]>`
      SELECT t."tmdbId", t."name", t."posterUrl", MAX(w."watchedAt") AS last
      FROM "WatchedEpisode" w JOIN "Episode" e ON e."id" = w."episodeId"
      JOIN "Season" s ON s."id" = e."seasonId" JOIN "Title" t ON t."id" = s."titleId"
      WHERE w."userId" = ${user.id} AND t."tmdbId" > 0
      GROUP BY t."id"`,
    prisma.watchedMovie.findMany({
      where: { userId: user.id, title: { tmdbId: { gt: 0 } } },
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
  ]
    .sort((a, b) => b.last.getTime() - a.last.getTime())
    .map(({ type, tmdbId, name, posterUrl }) => ({ type, tmdbId, name, posterUrl }));
  return { ok: true, titles };
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
  await prisma.user.update({ where: { id: user.id }, data: { coverPath: input.path } });
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
