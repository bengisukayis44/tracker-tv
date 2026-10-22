/** Activity feed rules that need no database, so they can be unit tested. */

export type FeedUser = { username: string; avatarUrl: string | null };

/** One thing a followed user did. */
export type FeedEvent =
  | {
      kind: "episode";
      at: Date;
      user: FeedUser;
      rewatch: boolean;
      rating: number | null;
      series: { tmdbId: number | null; name: string; posterUrl: string | null };
      episode: { seasonNumber: number; episodeNumber: number; name: string };
    }
  | {
      kind: "movie";
      at: Date;
      user: FeedUser;
      rewatch: boolean;
      rating: number | null;
      movie: { tmdbId: number | null; name: string; posterUrl: string | null };
    }
  | {
      kind: "comment";
      at: Date;
      user: FeedUser;
      id: string;
      content: string;
      isSpoiler: boolean;
      where: { name: string; detail: string | null; href: string; posterUrl: string | null };
    };

type EpisodeEvent = Extract<FeedEvent, { kind: "episode" }>;

/** A feed line: single events, or several episodes of one series watched by one person on one day. */
export type FeedItem =
  | Exclude<FeedEvent, EpisodeEvent>
  | (Omit<EpisodeEvent, "episode" | "rating" | "rewatch"> & { episodes: EpisodeEvent[] });

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" });

/**
 * Newest first, at most `limit` lines. Episodes of the same series watched by the same person on the same
 * (Turkish) day become one line, so marking a whole season does not flood the feed.
 */
export function buildFeed(events: FeedEvent[], limit = 60): FeedItem[] {
  const sorted = [...events].sort((a, b) => b.at.getTime() - a.at.getTime());
  const items: FeedItem[] = [];
  const groups = new Map<string, Extract<FeedItem, { episodes: EpisodeEvent[] }>>();

  for (const event of sorted) {
    if (event.kind !== "episode") {
      items.push(event);
      continue;
    }
    const key = `${event.user.username}|${event.series.tmdbId}|${dayKey.format(event.at)}`;
    const group = groups.get(key);
    if (group) {
      group.episodes.push(event);
      continue;
    }
    const created = { kind: "episode" as const, at: event.at, user: event.user, series: event.series, episodes: [event] };
    groups.set(key, created);
    items.push(created);
  }

  for (const group of groups.values()) {
    group.episodes.sort(
      (a, b) => a.episode.seasonNumber - b.episode.seasonNumber || a.episode.episodeNumber - b.episode.episodeNumber,
    );
  }
  return items.slice(0, limit);
}
