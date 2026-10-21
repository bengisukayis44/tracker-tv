/**
 * Watch-tracking rules that do not need the database, so they can be unit tested
 * (PROJE_PLANI.md §5 "Kaldığın yer mantığı").
 */
import { isAired, sortSeasons } from "@/lib/episodes";

type EpisodeLike = { id: string; episodeNumber: number; airDate: Date | null };
type SeasonLike<E extends EpisodeLike> = { seasonNumber: number; episodes: E[] };

/** Regular episodes in viewing order: seasons ascending (specials excluded), episodes ascending. */
export function orderedEpisodes<E extends EpisodeLike>(seasons: SeasonLike<E>[]) {
  return sortSeasons(seasons)
    .filter((s) => s.seasonNumber !== 0)
    .flatMap((s) =>
      [...s.episodes]
        .sort((a, b) => a.episodeNumber - b.episodeNumber)
        .map((episode) => ({ seasonNumber: s.seasonNumber, episode })),
    );
}

/**
 * Aired, unwatched episodes that come before `episodeId` — offered as
 * "Önceki bölümleri de izlendi olarak işaretle?" after marking an episode watched.
 */
export function previousUnwatchedEpisodeIds<E extends EpisodeLike>(
  seasons: SeasonLike<E>[],
  episodeId: string,
  watched: ReadonlySet<string>,
  now = new Date(),
): string[] {
  const ordered = orderedEpisodes(seasons);
  const index = ordered.findIndex((item) => item.episode.id === episodeId);
  if (index <= 0) return [];
  return ordered
    .slice(0, index)
    .filter(({ episode }) => !watched.has(episode.id) && isAired(episode, now))
    .map(({ episode }) => episode.id);
}

/** Watched count against all regular episodes (e.g. "42/60 bölüm izlendi"). */
export function watchProgress<E extends EpisodeLike>(seasons: SeasonLike<E>[], watched: ReadonlySet<string>) {
  const all = orderedEpisodes(seasons);
  const watchedCount = all.filter(({ episode }) => watched.has(episode.id)).length;
  const total = all.length;
  return { watched: watchedCount, total, percent: total === 0 ? 0 : Math.round((watchedCount / total) * 100) };
}

/** Episodes of one season that can be marked in bulk (only aired ones). */
export function airedEpisodeIds<E extends EpisodeLike>(episodes: E[], now = new Date()): string[] {
  return episodes.filter((ep) => isAired(ep, now)).map((ep) => ep.id);
}

/** True when every aired episode of the season is watched (and at least one has aired). */
export function isSeasonWatched<E extends EpisodeLike>(
  episodes: E[],
  watched: ReadonlySet<string>,
  now = new Date(),
): boolean {
  const aired = airedEpisodeIds(episodes, now);
  return aired.length > 0 && aired.every((id) => watched.has(id));
}

/**
 * "Kaldığın yer" (PROJE_PLANI.md §5): the furthest watched regular episode and the first aired episode after
 * it. `next` is null when the viewer has caught up (or nothing is watched); the series is then not
 * "İzlemeye devam et" material.
 */
export function nextEpisode<E extends EpisodeLike>(
  seasons: SeasonLike<E>[],
  watched: ReadonlySet<string>,
  now = new Date(),
) {
  const ordered = orderedEpisodes(seasons);
  let lastIndex = -1;
  ordered.forEach(({ episode }, i) => {
    if (watched.has(episode.id)) lastIndex = i;
  });
  if (lastIndex === -1) return { last: null, next: null };
  const next = ordered.slice(lastIndex + 1).find(({ episode }) => isAired(episode, now)) ?? null;
  return { last: ordered[lastIndex], next };
}
