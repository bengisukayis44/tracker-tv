import { describe, expect, it } from "vitest";
import { describeAppearance, seasonRanges } from "@/lib/appearance";

const ep = (season: number, episode: number) => ({ season, episode, name: `B${episode}` });

describe("seasonRanges", () => {
  it.each([
    [[1, 2, 3, 4], "1–4"],
    [[1, 3, 5], "1, 3 ve 5"],
    [[1, 2, 3, 5], "1–3 ve 5"],
    [[1, 2], "1 ve 2"],
    [[4, 1, 2, 3, 3], "1–4"],
    [[7], "7"],
  ])("%j → %s", (seasons, expected) => expect(seasonRanges(seasons)).toBe(expected));
});

describe("describeAppearance", () => {
  it("lists a guest part episode by episode, in order and without duplicates", () => {
    expect(describeAppearance({ episodes: [ep(2, 8), ep(1, 4), ep(1, 4)], seasons: [1, 2], episodeCount: 2 })).toEqual({
      kind: "episodes",
      episodes: [ep(1, 4), ep(2, 8)],
    });
  });

  it("sums up longer parts by season", () => {
    expect(describeAppearance({ episodes: [], seasons: [2], episodeCount: 6 })).toEqual({
      kind: "seasons",
      text: "2. sezon · 6 bölüm",
    });
    expect(
      describeAppearance({ episodes: [ep(1, 4), ep(2, 6), ep(2, 8), ep(2, 9)], seasons: [], episodeCount: 4 }),
    ).toEqual({ kind: "seasons", text: "1. ve 2. sezon · 4 bölüm" });
    expect(describeAppearance({ episodes: [ep(0, 1)], seasons: [2, 0, 3, 4, 1], episodeCount: 15 })).toEqual({
      kind: "seasons",
      text: "Sezon 1–4 + özel bölümler · 15 bölüm",
    });
  });

  it("uses the count alone when nothing else is known", () => {
    expect(describeAppearance({ episodes: [], seasons: [], episodeCount: 12 })).toEqual({
      kind: "count",
      text: "12 bölüm",
    });
    expect(describeAppearance({ episodes: [], seasons: [0], episodeCount: 5 })).toEqual({
      kind: "seasons",
      text: "Özel bölümler · 5 bölüm",
    });
  });
});
