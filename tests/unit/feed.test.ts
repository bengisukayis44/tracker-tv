import { describe, expect, it } from "vitest";
import { buildFeed, type FeedEvent } from "@/lib/feed";

const ali = { username: "ali", avatarUrl: null };
const ayse = { username: "ayse", avatarUrl: null };
const sherlock = { tmdbId: 19885, name: "Sherlock", posterUrl: null };
const dark = { tmdbId: 70523, name: "Dark", posterUrl: null };

const episode = (user: typeof ali, series: typeof sherlock, s: number, e: number, at: string): FeedEvent => ({
  kind: "episode",
  at: new Date(at),
  user,
  rewatch: false,
  rating: null,
  series,
  episode: { seasonNumber: s, episodeNumber: e, name: `Bölüm ${e}` },
});

describe("buildFeed", () => {
  it("groups one person's episodes of one series on one Turkish day, in episode order", () => {
    const feed = buildFeed([
      episode(ali, sherlock, 1, 2, "2026-10-21T18:00:00Z"),
      episode(ali, sherlock, 1, 1, "2026-10-21T17:00:00Z"),
      episode(ali, sherlock, 1, 3, "2026-10-21T19:00:00Z"),
    ]);
    expect(feed).toHaveLength(1);
    expect(feed[0].kind === "episode" && feed[0].episodes.map((e) => e.episode.episodeNumber)).toEqual([1, 2, 3]);
    // The line is dated by the latest watch
    expect(feed[0].at.toISOString()).toBe("2026-10-21T19:00:00.000Z");
  });

  it("keeps different people, series and days apart, newest first", () => {
    const feed = buildFeed([
      episode(ali, sherlock, 1, 1, "2026-10-20T10:00:00Z"),
      episode(ali, sherlock, 1, 2, "2026-10-21T10:00:00Z"),
      episode(ayse, sherlock, 1, 1, "2026-10-21T11:00:00Z"),
      episode(ali, dark, 1, 1, "2026-10-21T12:00:00Z"),
      { kind: "movie", at: new Date("2026-10-21T13:00:00Z"), user: ayse, rewatch: true, rating: 9, movie: sherlock },
    ]);
    expect(feed.map((i) => [i.kind, i.user.username, i.at.toISOString().slice(0, 13)])).toEqual([
      ["movie", "ayse", "2026-10-21T13"],
      ["episode", "ali", "2026-10-21T12"],
      ["episode", "ayse", "2026-10-21T11"],
      ["episode", "ali", "2026-10-21T10"],
      ["episode", "ali", "2026-10-20T10"],
    ]);
  });

  it("uses the Turkish calendar day: 23:30 and 00:30 in Istanbul are different days", () => {
    const feed = buildFeed([
      episode(ali, sherlock, 1, 1, "2026-10-21T20:30:00Z"),
      episode(ali, sherlock, 1, 2, "2026-10-21T21:30:00Z"),
    ]);
    expect(feed).toHaveLength(2);
  });

  it("stops at the limit", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      episode(ali, { ...dark, tmdbId: i }, 1, 1, "2026-10-21T10:00:00Z"),
    );
    expect(buildFeed(many, 4)).toHaveLength(4);
  });
});
