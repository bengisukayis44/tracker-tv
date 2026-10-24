import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { describeAppearance, type Appearance, type AppearanceEpisode } from "@/lib/appearance";
import { rankCredits } from "@/lib/recommend";
import { cleanText, isPlaceholderEpisodeName, tmdb, tmdbImage } from "@/lib/tmdb";

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
      /** TMDB credit ids of every role in it, for the episode details */
      creditIds: string[];
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
      existing.creditIds.push(c.credit_id);
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
      creditIds: [c.credit_id],
    });
  }
  const appearances = await seriesAppearances([...byKey.values()].filter((c) => c.type === "SERIES"));
  // Series only: a movie can have the same TMDB id as a series
  const withAppearance = <T extends { tmdbId: number }>(c: T) => ({
    ...c,
    appearance: appearances.get(c.tmdbId) ?? null,
  });
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
        .map(withAppearance)
        .sort((a, b) => (b.episodeCount ?? 1) - (a.episodeCount ?? 1) || b.voteCount - a.voteCount),
      // Movies by fame (rankCredits order)
      ...[...byKey.values()].filter((c) => c.type === "MOVIE").map((c) => ({ ...c, appearance: null })),
    ],
  };
}

// Detail requests at a time (an actor can have dozens of series roles)
const DETAIL_CONCURRENCY = 8;

/**
 * Which episodes or seasons the actor is in, per series (TMDB tmdbId → Appearance). Listed episodes get their
 * Turkish name and a link when the series is stored here. A role whose details do not arrive keeps only its count.
 */
async function seriesAppearances(series: { tmdbId: number; creditIds: string[]; episodeCount: number | null }[]) {
  const jobs = series.flatMap((s) => s.creditIds.map((creditId) => ({ tmdbId: s.tmdbId, creditId })));
  const details = new Map<number, { episodes: AppearanceEpisode[]; seasons: number[] }>();
  for (let i = 0; i < jobs.length; i += DETAIL_CONCURRENCY) {
    await Promise.all(
      jobs.slice(i, i + DETAIL_CONCURRENCY).map(async ({ tmdbId, creditId }) => {
        try {
          const { media } = await tmdb.creditDetails(creditId, { timeoutMs: 4_000, retries: 0 });
          const entry = details.get(tmdbId) ?? { episodes: [], seasons: [] };
          for (const e of media.episodes ?? []) {
            // "15. Bölüm"-like placeholders add nothing next to the code
            const name = isPlaceholderEpisodeName(e.name) ? "" : (cleanText(e.name) ?? "");
            entry.episodes.push({ season: e.season_number, episode: e.episode_number, name });
          }
          for (const season of media.seasons ?? []) entry.seasons.push(season.season_number);
          details.set(tmdbId, entry);
        } catch {
          // Only the episode count is shown for this role
        }
      }),
    );
  }

  const result = new Map<number, Appearance>();
  for (const s of series) {
    const d = details.get(s.tmdbId) ?? { episodes: [], seasons: [] };
    result.set(s.tmdbId, describeAppearance({ ...d, episodeCount: s.episodeCount }));
  }

  // Turkish names for the listed episodes of series stored here
  const listed = [...result.entries()].filter(([, a]) => a.kind === "episodes");
  if (listed.length) {
    const stored = await prisma.episode.findMany({
      where: { season: { title: { type: "SERIES", tmdbId: { in: listed.map(([id]) => id) } } } },
      select: {
        episodeNumber: true,
        name: true,
        season: { select: { seasonNumber: true, title: { select: { tmdbId: true } } } },
      },
    });
    const names = new Map(
      stored.map((e) => [`${e.season.title.tmdbId}-${e.season.seasonNumber}-${e.episodeNumber}`, e.name]),
    );
    for (const [tmdbId, appearance] of listed) {
      if (appearance.kind !== "episodes") continue;
      for (const e of appearance.episodes) {
        const stored = names.get(`${tmdbId}-${e.season}-${e.episode}`);
        if (stored && !isPlaceholderEpisodeName(stored)) e.name = stored;
      }
    }
  }
  return result;
}

export const getPerson = unstable_cache(fetchPerson, ["person-v5"], { revalidate: 24 * 60 * 60 });

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

/** An actor in the search results. */
export type ActorResult = { id: number; name: string; photoUrl: string | null; knownFor: string[] };

async function fetchActors(query: string): Promise<ActorResult[]> {
  const people = await tmdb.searchPeople(query, { timeoutMs: 4_000, retries: 1 });
  return people
    .filter((p) => p.known_for_department === "Acting")
    .map((p) => ({
      id: p.id,
      name: p.name,
      photoUrl: tmdbImage(p.profile_path, "w185"),
      knownFor: (p.known_for ?? [])
        .map((k) => ("name" in k ? k.name : "title" in k ? k.title : null))
        .filter((t): t is string => Boolean(t))
        .slice(0, 3),
    }));
}

/** Actors whose name matches the search, from TMDB, cached for a day; an unreachable TMDB gives none. */
export async function searchActors(query: string): Promise<ActorResult[]> {
  const q = query.trim().toLocaleLowerCase("tr-TR");
  if (q.length < 2) return [];
  try {
    return await cachedActors(q);
  } catch (err) {
    console.error("Oyuncu araması başarısız:", err);
    return [];
  }
}
const cachedActors = unstable_cache(fetchActors, ["actor-search-v1"], { revalidate: 24 * 60 * 60 });
