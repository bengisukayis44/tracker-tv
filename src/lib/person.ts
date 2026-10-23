import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { rankCredits } from "@/lib/recommend";
import { cleanText, tmdb, tmdbImage } from "@/lib/tmdb";

/** An actor's page data (`/person/[id]`), straight from TMDB and cached for a day. */
async function fetchPerson(personId: number) {
  const person = await tmdb.getPerson(personId, { timeoutMs: 6_000, retries: 1 });
  // One card per series/movie: an actor can appear in the same series under several roles
  const byKey = new Map<
    string,
    {
      type: "SERIES" | "MOVIE";
      tmdbId: number;
      name: string;
      posterUrl: string | null;
      year: number | null;
      characters: string[];
      voteCount: number;
      episodeCount: number | null;
    }
  >();
  for (const c of rankCredits(person.combined_credits?.cast ?? [])) {
    const type = c.media_type === "tv" ? ("SERIES" as const) : ("MOVIE" as const);
    const key = `${type}-${c.id}`;
    const character = cleanText(c.character);
    const existing = byKey.get(key);
    if (existing) {
      // Another role in the same series: its episodes count too
      if (character && !existing.characters.includes(character)) existing.characters.push(character);
      if (c.media_type === "tv") existing.episodeCount = (existing.episodeCount ?? 0) + (c.episode_count ?? 0);
      continue;
    }
    const date = c.media_type === "tv" ? c.first_air_date : c.release_date;
    byKey.set(key, {
      type,
      tmdbId: c.id,
      name: cleanText(c.media_type === "tv" ? c.name : c.title) ?? "",
      posterUrl: tmdbImage(c.poster_path, "w342"),
      year: date ? Number(date.slice(0, 4)) : null,
      characters: character ? [character] : [],
      voteCount: c.vote_count,
      episodeCount: c.media_type === "tv" ? (c.episode_count ?? null) : null,
    });
  }
  return {
    id: person.id,
    name: person.name,
    biography: cleanText(person.biography),
    birthday: person.birthday,
    deathday: person.deathday,
    placeOfBirth: cleanText(person.place_of_birth),
    // h632 is TMDB's large size for profile photos
    photoUrl: person.profile_path ? `https://image.tmdb.org/t/p/h632${person.profile_path}` : null,
    imdbId: person.imdb_id,
    credits: [
      // Series by how many episodes they are in (a one-episode guest spot in a famous show comes later), then fame
      ...[...byKey.values()]
        .filter((c) => c.type === "SERIES")
        .sort((a, b) => (b.episodeCount ?? 1) - (a.episodeCount ?? 1) || b.voteCount - a.voteCount),
      // Movies by fame (rankCredits order)
      ...[...byKey.values()].filter((c) => c.type === "MOVIE"),
    ],
  };
}

export const getPerson = unstable_cache(fetchPerson, ["person-v3"], { revalidate: 24 * 60 * 60 });

export type PersonPage = Awaited<ReturnType<typeof fetchPerson>>;

/** Which of the given series/movies the viewer has watched (keys "SERIES-123" / "MOVIE-456"). */
export async function watchedAmong(userId: string, credits: { type: "SERIES" | "MOVIE"; tmdbId: number }[]) {
  const seriesIds = credits.filter((c) => c.type === "SERIES").map((c) => c.tmdbId);
  const movieIds = credits.filter((c) => c.type === "MOVIE").map((c) => c.tmdbId);
  const [series, movies] = await Promise.all([
    seriesIds.length
      ? prisma.$queryRaw<{ tmdbId: number }[]>`
          SELECT DISTINCT t."tmdbId"
          FROM "WatchedEpisode" w JOIN "Episode" e ON e."id" = w."episodeId"
          JOIN "Season" s ON s."id" = e."seasonId" JOIN "Title" t ON t."id" = s."titleId"
          WHERE w."userId" = ${userId} AND t."type" = 'SERIES' AND t."tmdbId" = ANY(${seriesIds}::int[])`
      : [],
    movieIds.length
      ? prisma.watchedMovie.findMany({
          where: { userId, title: { type: "MOVIE", tmdbId: { in: movieIds } } },
          select: { title: { select: { tmdbId: true } } },
        })
      : [],
  ]);
  return new Set([...series.map((s) => `SERIES-${s.tmdbId}`), ...movies.map((m) => `MOVIE-${m.title.tmdbId}`)]);
}
