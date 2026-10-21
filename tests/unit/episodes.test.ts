import { describe, expect, it } from "vitest";
import { findEpisodeWithNeighbors, isAired, sortSeasons } from "@/lib/episodes";

const ep = (
  episodeNumber: number,
  airDate: string | null = "2020-01-01T00:00:00Z",
) => ({
  episodeNumber,
  name: `Bölüm ${episodeNumber}`,
  airDate: airDate ? new Date(airDate) : null,
});

const seasons = [
  { seasonNumber: 2, episodes: [ep(2), ep(1)] }, // deliberately unsorted
  { seasonNumber: 0, episodes: [ep(1)] }, // specials
  { seasonNumber: 1, episodes: [ep(1), ep(2), ep(3)] },
];

describe("isAired", () => {
  const now = new Date("2026-01-01T00:00:00Z");

  it("is true for past air dates and exactly now", () => {
    expect(isAired({ airDate: new Date("2025-12-31T23:59:59Z") }, now)).toBe(
      true,
    );
    expect(isAired({ airDate: now }, now)).toBe(true);
  });

  it("is false for future or unknown air dates", () => {
    expect(isAired({ airDate: new Date("2026-01-01T00:00:01Z") }, now)).toBe(
      false,
    );
    expect(isAired({ airDate: null }, now)).toBe(false);
  });
});

describe("sortSeasons", () => {
  it("orders seasons ascending with specials last, without mutating the input", () => {
    const sorted = sortSeasons(seasons);
    expect(sorted.map((s) => s.seasonNumber)).toEqual([1, 2, 0]);
    expect(seasons.map((s) => s.seasonNumber)).toEqual([2, 0, 1]);
  });
});

describe("findEpisodeWithNeighbors", () => {
  it("finds an episode with its neighbours inside a season", () => {
    const found = findEpisodeWithNeighbors(seasons, 1, 2);
    expect(found?.episode.episodeNumber).toBe(2);
    expect(found?.previous).toEqual({
      seasonNumber: 1,
      episodeNumber: 1,
      name: "Bölüm 1",
    });
    expect(found?.next).toEqual({
      seasonNumber: 1,
      episodeNumber: 3,
      name: "Bölüm 3",
    });
  });

  it("crosses season boundaries in both directions", () => {
    expect(findEpisodeWithNeighbors(seasons, 1, 3)?.next).toMatchObject({
      seasonNumber: 2,
      episodeNumber: 1,
    });
    expect(findEpisodeWithNeighbors(seasons, 2, 1)?.previous).toMatchObject({
      seasonNumber: 1,
      episodeNumber: 3,
    });
  });

  it("has no previous for the first and no next for the last regular episode", () => {
    expect(findEpisodeWithNeighbors(seasons, 1, 1)?.previous).toBeNull();
    expect(findEpisodeWithNeighbors(seasons, 2, 2)?.next).toBeNull();
  });

  it("skips specials when navigating regular episodes but can open a special itself", () => {
    expect(findEpisodeWithNeighbors(seasons, 2, 2)?.next).toBeNull();
    const special = findEpisodeWithNeighbors(seasons, 0, 1);
    expect(special?.season.seasonNumber).toBe(0);
  });

  it("returns null for unknown seasons or episodes", () => {
    expect(findEpisodeWithNeighbors(seasons, 9, 1)).toBeNull();
    expect(findEpisodeWithNeighbors(seasons, 1, 99)).toBeNull();
    expect(findEpisodeWithNeighbors(seasons, Number.NaN, 1)).toBeNull();
  });
});
