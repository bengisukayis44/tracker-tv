import { EMOTIONS } from "@/lib/emotions";

/** What one viewer recorded; personal notes are never part of it. */
export type CommunityRow = {
  rating: number | null;
  emotions: string[];
  favoriteCastId: number | null;
  favoriteCharacter: string | null;
};

// Characters beyond this are left out of "En sevilen karakterler"
const TOP_CHARACTERS = 5;

const percentOf = (count: number, total: number) => (total === 0 ? 0 : Math.round((count / total) * 100));

/**
 * Topluluk istatistikleri for an episode or movie: how many watched it, the average rating of those who rated,
 * how often each emotion was picked (share of viewers) and the most loved characters.
 */
export function summarizeCommunity(rows: CommunityRow[]) {
  const watchers = rows.length;
  const ratings = rows.map((r) => r.rating).filter((r): r is number => r !== null);
  const averageRating = ratings.length
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
    : null;

  const emotions = EMOTIONS.map((e) => {
    const count = rows.filter((r) => r.emotions.includes(e.value)).length;
    return { ...e, count, percent: percentOf(count, watchers) };
  })
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count);

  const byCharacter = new Map<number, { castId: number; character: string; count: number }>();
  for (const r of rows) {
    if (r.favoriteCastId === null || !r.favoriteCharacter) continue;
    const entry = byCharacter.get(r.favoriteCastId) ?? {
      castId: r.favoriteCastId,
      character: r.favoriteCharacter,
      count: 0,
    };
    entry.count++;
    byCharacter.set(r.favoriteCastId, entry);
  }
  const characterVotes = [...byCharacter.values()].reduce((sum, c) => sum + c.count, 0);
  const characters = [...byCharacter.values()]
    .sort((a, b) => b.count - a.count || a.character.localeCompare(b.character, "tr"))
    .slice(0, TOP_CHARACTERS)
    .map((c) => ({ ...c, percent: percentOf(c.count, characterVotes) }));

  return { watchers, ratingCount: ratings.length, averageRating, emotions, characters };
}

export type CommunityStats = ReturnType<typeof summarizeCommunity>;
