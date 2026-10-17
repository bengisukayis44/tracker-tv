/**
 * Episode navigation helpers shared by the series and episode pages.
 * Pure functions over the series shape returned by getSeries, so they are easy to test.
 */

type EpisodeLike = { episodeNumber: number; name: string; airDate: Date | null };

export function isAired(episode: { airDate: Date | null }, now = new Date()): boolean {
  return episode.airDate != null && episode.airDate.getTime() <= now.getTime();
}

/** Specials (season 0) sort last so "Sezon 1" is the default tab. */
export function sortSeasons<S extends { seasonNumber: number }>(seasons: S[]): S[] {
  return [...seasons].sort((a, b) => {
    if (a.seasonNumber === 0) return 1;
    if (b.seasonNumber === 0) return -1;
    return a.seasonNumber - b.seasonNumber;
  });
}

export type EpisodeRef = { seasonNumber: number; episodeNumber: number; name: string };

/** Finds an episode plus the previous/next one across season boundaries (specials excluded). */
export function findEpisodeWithNeighbors<E extends EpisodeLike>(
  seasons: { seasonNumber: number; episodes: E[] }[],
  seasonNumber: number,
  episodeNumber: number,
) {
  const ordered = sortSeasons(seasons)
    .filter((s) => s.seasonNumber !== 0 || s.seasonNumber === seasonNumber)
    .flatMap((season) =>
      [...season.episodes].sort((a, b) => a.episodeNumber - b.episodeNumber).map((episode) => ({ season, episode })),
    );

  const index = ordered.findIndex(
    ({ season, episode }) => season.seasonNumber === seasonNumber && episode.episodeNumber === episodeNumber,
  );
  if (index === -1) return null;

  const toRef = (item: (typeof ordered)[number] | undefined): EpisodeRef | null =>
    item
      ? { seasonNumber: item.season.seasonNumber, episodeNumber: item.episode.episodeNumber, name: item.episode.name }
      : null;

  return {
    season: ordered[index].season,
    episode: ordered[index].episode,
    previous: toRef(ordered[index - 1]),
    next: toRef(ordered[index + 1]),
  };
}
