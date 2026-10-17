import { describe, expect, it } from "vitest";
import { Emotion } from "@/generated/prisma/enums";
import { EMOTIONS, emotionMeta } from "@/lib/emotions";
import { watchEpisodeSchema } from "@/lib/validations/watch";
import {
  airedEpisodeIds,
  isSeasonWatched,
  orderedEpisodes,
  previousUnwatchedEpisodeIds,
  watchProgress,
} from "@/lib/watch";

const now = new Date("2026-06-01T00:00:00Z");
const PAST = "2020-01-01T00:00:00Z";
const FUTURE = "2027-01-01T00:00:00Z";

const ep = (id: string, episodeNumber: number, airDate: string | null = PAST) => ({
  id,
  episodeNumber,
  airDate: airDate ? new Date(airDate) : null,
});

// s1e1..s1e3, s2e1..s2e2 (s2e2 not aired yet), plus a special that must be ignored
const seasons = [
  { seasonNumber: 2, episodes: [ep("s2e2", 2, FUTURE), ep("s2e1", 1)] },
  { seasonNumber: 0, episodes: [ep("special", 1)] },
  { seasonNumber: 1, episodes: [ep("s1e3", 3), ep("s1e1", 1), ep("s1e2", 2)] },
];

describe("orderedEpisodes", () => {
  it("orders by season then episode and leaves specials out", () => {
    expect(orderedEpisodes(seasons).map((x) => x.episode.id)).toEqual(["s1e1", "s1e2", "s1e3", "s2e1", "s2e2"]);
  });
});

describe("previousUnwatchedEpisodeIds", () => {
  it("returns earlier aired episodes that are not watched, across seasons", () => {
    expect(previousUnwatchedEpisodeIds(seasons, "s2e1", new Set(["s1e2"]), now)).toEqual(["s1e1", "s1e3"]);
  });

  it("is empty for the first episode, when everything before is watched, or for unknown ids", () => {
    expect(previousUnwatchedEpisodeIds(seasons, "s1e1", new Set(), now)).toEqual([]);
    expect(previousUnwatchedEpisodeIds(seasons, "s1e3", new Set(["s1e1", "s1e2"]), now)).toEqual([]);
    expect(previousUnwatchedEpisodeIds(seasons, "nope", new Set(), now)).toEqual([]);
  });

  it("never offers unaired or special episodes", () => {
    const withUnairedBefore = [
      { seasonNumber: 1, episodes: [ep("a", 1, FUTURE), ep("b", 2)] },
      { seasonNumber: 0, episodes: [ep("special", 1)] },
    ];
    expect(previousUnwatchedEpisodeIds(withUnairedBefore, "b", new Set(), now)).toEqual([]);
  });
});

describe("watchProgress", () => {
  it("counts watched regular episodes against all regular episodes", () => {
    expect(watchProgress(seasons, new Set(["s1e1", "s2e1", "special"]))).toEqual({ watched: 2, total: 5, percent: 40 });
  });

  it("handles shows without episodes", () => {
    expect(watchProgress([], new Set())).toEqual({ watched: 0, total: 0, percent: 0 });
  });
});

describe("season helpers", () => {
  const season2 = seasons[0].episodes;

  it("only bulk-marks aired episodes", () => {
    expect(airedEpisodeIds(season2, now)).toEqual(["s2e1"]);
  });

  it("treats a season as watched when every aired episode is", () => {
    expect(isSeasonWatched(season2, new Set(["s2e1"]), now)).toBe(true);
    expect(isSeasonWatched(season2, new Set(), now)).toBe(false);
    expect(isSeasonWatched([ep("x", 1, FUTURE)], new Set(), now)).toBe(false);
  });
});

describe("watchEpisodeSchema", () => {
  const base = { episodeId: "ep1", rating: 8, emotions: ["MUTLU", "GERGIN"], note: "  Harika  " };

  it("accepts a full entry, trims the note and drops duplicate emotions", () => {
    const parsed = watchEpisodeSchema.parse({ ...base, emotions: ["MUTLU", "MUTLU", "GERGIN"] });
    expect(parsed).toEqual({ episodeId: "ep1", rating: 8, emotions: ["MUTLU", "GERGIN"], note: "Harika" });
  });

  it("accepts an empty entry (just 'İzledim')", () => {
    expect(watchEpisodeSchema.parse({ episodeId: "ep1", rating: null, emotions: [], note: "   " })).toEqual({
      episodeId: "ep1",
      rating: null,
      emotions: [],
      note: null,
    });
  });

  it.each([0, 11, 7.5])("rejects rating %s", (rating) => {
    expect(watchEpisodeSchema.safeParse({ ...base, rating }).success).toBe(false);
  });

  it("rejects unknown emotions and overlong notes", () => {
    expect(watchEpisodeSchema.safeParse({ ...base, emotions: ["UZGUN"] }).success).toBe(false);
    expect(watchEpisodeSchema.safeParse({ ...base, note: "x".repeat(1001) }).success).toBe(false);
  });
});

describe("emotions", () => {
  it("defines the ten emotions from the plan, each with a label and emoji", () => {
    expect(EMOTIONS.map((e) => e.value)).toEqual([
      "HUZUNLU",
      "MUTLU",
      "HEYECANLI",
      "GERGIN",
      "KORKMUS",
      "SASKIN",
      "SINIRLI",
      "DUYGULANMIS",
      "SIKILMIS",
      "EGLENMIS",
    ]);
    // Must stay in sync with the database enum
    expect(EMOTIONS.map((e) => e.value).sort()).toEqual(Object.values(Emotion).sort());
    expect(emotionMeta("KORKMUS")).toMatchObject({ label: "Korkmuş", emoji: "😱" });
    expect(emotionMeta("YOK")).toBeUndefined();
  });
});
