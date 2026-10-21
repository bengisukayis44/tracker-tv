import { cleanText, tmdbImage } from "@/lib/tmdb";

/** One cast member as stored in Title.castMembers. `id` is the actor's TMDB person id. */
export type CastMember = { id: number; name: string; character: string | null; profileUrl: string | null };

// Enough for the cast row and the "Favori karakter" picker
export const CAST_LIMIT = 20;

/** /tv/{id}?append_to_response=aggregate_credits — whole-series cast, most episodes first. */
export type TmdbAggregateCast = {
  id: number;
  name: string;
  profile_path: string | null;
  roles: { character: string; episode_count: number }[];
};

/** /movie/{id}?append_to_response=credits */
export type TmdbMovieCast = { id: number; name: string; profile_path: string | null; character: string };

/** Series cast in TMDB's order; an actor with several roles gets them joined, most-seen first. */
export function castFromAggregate(cast: TmdbAggregateCast[]): CastMember[] {
  return cast.slice(0, CAST_LIMIT).map((person) => {
    const characters = [...person.roles]
      .sort((a, b) => b.episode_count - a.episode_count)
      .map((r) => cleanText(r.character))
      .filter((c): c is string => Boolean(c));
    return {
      id: person.id,
      name: cleanText(person.name) ?? person.name,
      character: characters.length ? [...new Set(characters)].join(" / ") : null,
      profileUrl: tmdbImage(person.profile_path, "w185"),
    };
  });
}

export function castFromCredits(cast: TmdbMovieCast[]): CastMember[] {
  return cast.slice(0, CAST_LIMIT).map((person) => ({
    id: person.id,
    name: cleanText(person.name) ?? person.name,
    character: cleanText(person.character),
    profileUrl: tmdbImage(person.profile_path, "w185"),
  }));
}

/** Title.castMembers from the database; anything malformed is left out. */
export function parseCast(value: unknown): CastMember[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (m): m is CastMember =>
      typeof m === "object" && m !== null && typeof m.id === "number" && typeof m.name === "string",
  );
}

/** "Sherlock Holmes" or, when the character is unknown, the actor's name. */
export function characterLabel(member: Pick<CastMember, "name" | "character">) {
  return member.character ?? member.name;
}
