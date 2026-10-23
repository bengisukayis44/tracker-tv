/** Recommendation rules that need no database or network, so they can be unit tested. */

export type GenreWeight = { genres: string[]; weight: number };

/**
 * The user's favourite genres: every watched title counts for its genres, weighted (more episodes watched,
 * higher ratings → more weight). Most weighted first.
 */
export function rankGenres(titles: GenreWeight[], limit = 3): string[] {
  const score = new Map<string, number>();
  for (const { genres, weight } of titles) {
    for (const genre of genres) score.set(genre, (score.get(genre) ?? 0) + weight);
  }
  return [...score.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"))
    .slice(0, limit)
    .map(([genre]) => genre);
}

/** Weight of one watched title for rankGenres: 1, plus up to 2 for many episodes, plus 1 for a high rating. */
export function titleWeight(watchedEpisodes: number, averageRating: number | null) {
  return 1 + Math.min(2, Math.log2(1 + watchedEpisodes) / 3) + (averageRating !== null && averageRating >= 8 ? 1 : 0);
}

// TMDB names series and movie genres differently ("Aksiyon & Macera" vs "Aksiyon", "Macera")
const BRIDGE: Record<string, string[]> = {
  "Aksiyon & Macera": ["Aksiyon", "Macera"],
  "Bilim Kurgu & Fantazi": ["Bilim-Kurgu", "Fantastik"],
  "Savaş & Politik": ["Savaş"],
  Aksiyon: ["Aksiyon & Macera"],
  Macera: ["Aksiyon & Macera"],
  "Bilim-Kurgu": ["Bilim Kurgu & Fantazi"],
  Fantastik: ["Bilim Kurgu & Fantazi"],
  Savaş: ["Savaş & Politik"],
};

/** The genre ids, in one kind's genre list (id → name), for genre names that may come from the other kind. */
export function genreIdsFor(names: string[], genres: Map<number, string>): number[] {
  const idByName = new Map([...genres.entries()].map(([id, name]) => [name, id]));
  const ids = names.flatMap((name) => [name, ...(BRIDGE[name] ?? [])]).map((name) => idByName.get(name));
  return [...new Set(ids.filter((id): id is number => id !== undefined))];
}

/** "Suç, Dram ve Gizem" */
export function joinTurkish(words: string[]) {
  return words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} ve ${words.at(-1)}`;
}

/**
 * The title "Bunları da sevdi" builds on: one of the well-rated ones (rating ≥ 8) if any, otherwise one of the
 * five most recently watched; it changes from day to day so the row does not stay the same.
 */
export function pickSeed<T extends { rating: number | null }>(recentFirst: T[], dayNumber: number): T | null {
  const liked = recentFirst.filter((t) => t.rating !== null && t.rating >= 8);
  const pool = liked.length ? liked : recentFirst.slice(0, 5);
  return pool.length ? pool[dayNumber % pool.length] : null;
}

// TMDB genre ids of talk shows and news: an actor's guest spots there are not worth recommending
const TALK_AND_NEWS = new Set([10767, 10763]);
const SELF = /^(self|himself|herself|kendisi|kendi)\b/i;

/**
 * An actor's other series and movies worth suggesting: no talk shows, news or "Himself" appearances,
 * nothing without a poster, the best known first.
 */
export function rankCredits<
  T extends { character: string | null; genre_ids: number[]; poster_path: string | null; vote_count: number },
>(credits: T[]): T[] {
  return credits
    .filter((c) => c.poster_path && !c.genre_ids.some((g) => TALK_AND_NEWS.has(g)) && !SELF.test(c.character ?? ""))
    .sort((a, b) => b.vote_count - a.vote_count);
}

/** Drops what the user already watched or listed (keys "SERIES-123" / "MOVIE-456") and duplicates. */
export function unseen<T extends { type: "SERIES" | "MOVIE"; tmdbId: number }>(items: T[], known: Set<string>): T[] {
  const seen = new Set(known);
  return items.filter((item) => {
    const key = `${item.type}-${item.tmdbId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
