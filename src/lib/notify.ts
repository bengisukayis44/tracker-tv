/** New-episode notification rules that need no database, so they can be unit tested. */
import { episodeCode } from "@/lib/format";

export type AiringEpisode = {
  titleId: string;
  seriesName: string;
  tmdbId: number | null;
  posterUrl: string | null;
  seasonNumber: number;
  episodeNumber: number;
  name: string;
};

export type PushMessage = { title: string; body: string; url: string; tag: string; icon?: string };

/**
 * One notification per user and series airing today: "Sherlock: yeni bölüm" / "S04E01 · Altı Thatcher bugün yayında",
 * or "3 yeni bölüm bugün yayında" when a series drops several at once.
 */
export function newEpisodeMessages(
  trackedByUser: Map<string, Set<string>>,
  airingToday: AiringEpisode[],
): Map<string, PushMessage[]> {
  const bySeries = new Map<string, AiringEpisode[]>();
  for (const ep of airingToday) bySeries.set(ep.titleId, [...(bySeries.get(ep.titleId) ?? []), ep]);
  for (const list of bySeries.values()) {
    list.sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber);
  }

  const result = new Map<string, PushMessage[]>();
  for (const [userId, titleIds] of trackedByUser) {
    const messages = [...titleIds].flatMap((titleId) => {
      const episodes = bySeries.get(titleId);
      if (!episodes) return [];
      const first = episodes[0];
      const code = episodeCode(first.seasonNumber, first.episodeNumber);
      return [
        {
          title: `${first.seriesName}: ${episodes.length > 1 ? `${episodes.length} yeni bölüm` : "yeni bölüm"}`,
          body: episodes.length > 1 ? `${code} ve sonrası bugün yayında` : `${code} · ${first.name} bugün yayında`,
          url: `/series/${first.tmdbId}/season/${first.seasonNumber}/episode/${first.episodeNumber}`,
          tag: `yeni-bolum-${titleId}-${code}`,
          ...(first.posterUrl ? { icon: first.posterUrl } : {}),
        },
      ];
    });
    if (messages.length) result.set(userId, messages);
  }
  return result;
}
