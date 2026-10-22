import { describe, expect, it } from "vitest";
import { newEpisodeMessages, type AiringEpisode } from "@/lib/notify";

const ep = (titleId: string, seriesName: string, s: number, e: number): AiringEpisode => ({
  titleId,
  seriesName,
  tmdbId: 100,
  posterUrl: null,
  seasonNumber: s,
  episodeNumber: e,
  name: `Bölüm ${e}`,
});

describe("newEpisodeMessages", () => {
  const tracked = new Map([
    ["ali", new Set(["dark", "sherlock"])],
    ["ayse", new Set(["sherlock"])],
    ["can", new Set(["office"])],
  ]);

  it("tells each user about today's episodes of the series they follow", () => {
    const messages = newEpisodeMessages(tracked, [ep("dark", "Dark", 2, 4)]);
    expect([...messages.keys()]).toEqual(["ali"]);
    expect(messages.get("ali")).toEqual([
      {
        title: "Dark: yeni bölüm",
        body: "S02E04 · Bölüm 4 bugün yayında",
        url: "/series/100/season/2/episode/4",
        tag: "yeni-bolum-dark-S02E04",
      },
    ]);
  });

  it("sums up several episodes of one series in one notification, from the first one", () => {
    const messages = newEpisodeMessages(tracked, [ep("sherlock", "Sherlock", 4, 3), ep("sherlock", "Sherlock", 4, 2)]);
    expect(messages.get("ayse")).toEqual([
      expect.objectContaining({ title: "Sherlock: 2 yeni bölüm", body: "S04E02 ve sonrası bugün yayında" }),
    ]);
    expect(messages.get("ali")).toHaveLength(1);
  });

  it("sends nothing when nothing followed airs today", () => {
    expect(newEpisodeMessages(tracked, []).size).toBe(0);
    expect(newEpisodeMessages(new Map(), [ep("dark", "Dark", 1, 1)]).size).toBe(0);
  });
});
