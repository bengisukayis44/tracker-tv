/** How an actor's part in a series is summed up on their page; no database or network, so unit tested. */

export type AppearanceEpisode = { season: number; episode: number; name: string };

export type Appearance =
  /** A guest part: the episodes one by one */
  | { kind: "episodes"; episodes: AppearanceEpisode[] }
  /** A longer part: which seasons, and how many episodes in all */
  | { kind: "seasons"; text: string }
  /** Nothing known beyond the count */
  | { kind: "count"; text: string };

/** Parts in at most this many episodes are listed episode by episode. */
export const LIST_UP_TO = 3;

/** "1–4", "1, 3 ve 5", "1–3 ve 5" */
export function seasonRanges(seasons: number[]): string {
  const sorted = [...new Set(seasons)].sort((a, b) => a - b);
  const ranges: string[] = [];
  for (let i = 0; i < sorted.length;) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    // Two in a row read better as "1 ve 2" than "1–2"
    if (j - i >= 2) ranges.push(`${sorted[i]}–${sorted[j]}`);
    else for (let k = i; k <= j; k++) ranges.push(String(sorted[k]));
    i = j + 1;
  }
  return ranges.length <= 1 ? (ranges[0] ?? "") : `${ranges.slice(0, -1).join(", ")} ve ${ranges.at(-1)}`;
}

/**
 * - up to LIST_UP_TO known episodes: listed ("S24E12 · …")
 * - otherwise the seasons: "2. sezon", "1. ve 2. sezon", "Sezon 1–4 + özel bölümler", then "· 15 bölüm"
 */
export function describeAppearance(input: {
  episodes: AppearanceEpisode[];
  seasons: number[];
  episodeCount: number | null;
}): Appearance {
  const episodes = [...new Map(input.episodes.map((e) => [`${e.season}-${e.episode}`, e])).values()].sort(
    (a, b) => a.season - b.season || a.episode - b.episode,
  );
  const count = Math.max(input.episodeCount ?? 0, episodes.length);
  if (episodes.length > 0 && count <= LIST_UP_TO) return { kind: "episodes", episodes };

  const all = new Set([...input.seasons, ...episodes.map((e) => e.season)]);
  const regular = [...all].filter((s) => s > 0);
  const specials = all.has(0);
  const countText = count > 0 ? ` · ${count} bölüm` : "";
  if (regular.length === 0 && !specials) return { kind: "count", text: count > 0 ? `${count} bölüm` : "" };

  let text: string;
  if (regular.length === 0) text = "Özel bölümler";
  else if (regular.length === 1) text = `${regular[0]}. sezon`;
  else if (regular.length === 2) text = `${Math.min(...regular)}. ve ${Math.max(...regular)}. sezon`;
  else text = `Sezon ${seasonRanges(regular)}`;
  if (specials && regular.length > 0) text += " + özel bölümler";
  return { kind: "seasons", text: text + countText };
}
