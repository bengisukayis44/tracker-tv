"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isImagePath, pickCoverImages } from "@/lib/cover";
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

async function imagesOf({ type, tmdbId }: TitleInput) {
  return pickCoverImages(await tmdb.backdrops(type === "SERIES" ? "tv" : "movie", tmdbId, { timeoutMs: 8_000 }));
}

/** Up to ten wide scene images of a watched series or movie. */
export async function getCoverImages(input: TitleInput): Promise<ActionResult<{ images: string[] }>> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;
  const parsed = titleSchema.safeParse(input);
  if (!parsed.success || !(await hasWatched(user.id, parsed.data))) {
    return { ok: false, error: "Kapak yalnızca izlediğin dizi ve filmlerden seçilebilir." };
  }
  try {
    return { ok: true, images: await imagesOf(parsed.data) };
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
    // Only an image TMDB actually lists for that title
    if (!(await imagesOf(parsed.data)).includes(input.path)) return { ok: false, error: "Bu görsel kapak yapılamaz." };
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
