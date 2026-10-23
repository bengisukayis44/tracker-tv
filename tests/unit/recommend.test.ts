import { describe, expect, it } from "vitest";
import { genreIdsFor, joinTurkish, pickSeed, rankCredits, rankGenres, titleWeight, unseen } from "@/lib/recommend";

describe("rankGenres", () => {
  it("adds up each title's weight per genre, heaviest first, at most three", () => {
    expect(
      rankGenres([
        { genres: ["Suç", "Dram"], weight: 3 },
        { genres: ["Dram", "Gizem"], weight: 1 },
        { genres: ["Komedi"], weight: 0.5 },
        { genres: ["Gizem"], weight: 1 },
      ]),
    ).toEqual(["Dram", "Suç", "Gizem"]);
    expect(rankGenres([])).toEqual([]);
  });

  it("weighs many watched episodes and high ratings more", () => {
    expect(titleWeight(1, null)).toBeLessThan(titleWeight(30, null));
    expect(titleWeight(30, null)).toBeLessThanOrEqual(3);
    expect(titleWeight(1, 9) - titleWeight(1, 7)).toBeCloseTo(1);
  });
});

describe("genreIdsFor", () => {
  const tv = new Map([
    [10759, "Aksiyon & Macera"],
    [80, "Suç"],
    [10765, "Bilim Kurgu & Fantazi"],
  ]);
  const movie = new Map([
    [28, "Aksiyon"],
    [12, "Macera"],
    [80, "Suç"],
    [878, "Bilim-Kurgu"],
  ]);

  it("finds the same genres across series and movie names", () => {
    expect(genreIdsFor(["Aksiyon & Macera", "Suç"], movie)).toEqual([28, 12, 80]);
    expect(genreIdsFor(["Aksiyon", "Macera", "Bilim-Kurgu"], tv)).toEqual([10759, 10765]);
    expect(genreIdsFor(["Belgesel"], tv)).toEqual([]);
  });
});

describe("joinTurkish", () => {
  it.each([
    [["Suç"], "Suç"],
    [["Suç", "Dram"], "Suç ve Dram"],
    [["Suç", "Dram", "Gizem"], "Suç, Dram ve Gizem"],
    [[], ""],
  ])("%j → %s", (words, expected) => expect(joinTurkish(words)).toBe(expected));
});

describe("pickSeed", () => {
  const titles = [
    { name: "Yeni", rating: null },
    { name: "Güzel", rating: 9 },
    { name: "Orta", rating: 6 },
    { name: "Harika", rating: 10 },
  ];

  it("takes a well-rated title, a different one from day to day", () => {
    expect(pickSeed(titles, 0)?.name).toBe("Güzel");
    expect(pickSeed(titles, 1)?.name).toBe("Harika");
    expect(pickSeed(titles, 2)?.name).toBe("Güzel");
  });

  it("falls back to the most recent ones without high ratings, and to nothing without history", () => {
    const plain = titles.map((t) => ({ ...t, rating: null }));
    expect(pickSeed(plain, 0)?.name).toBe("Yeni");
    expect(pickSeed([], 3)).toBeNull();
  });
});

describe("rankCredits", () => {
  const credit = (
    over: Partial<{ character: string | null; genre_ids: number[]; poster_path: string | null; vote_count: number }>,
  ) => ({
    character: "Doctor Strange",
    genre_ids: [28],
    poster_path: "/p.jpg",
    vote_count: 100,
    ...over,
  });

  it("leaves out talk shows, news, self appearances and posterless entries, best known first", () => {
    const ranked = rankCredits([
      credit({ character: "Alan Turing", vote_count: 500 }),
      credit({ character: "Himself", vote_count: 9000 }),
      credit({ character: "Kendisi", vote_count: 9000 }),
      credit({ genre_ids: [10767], vote_count: 9000 }),
      credit({ genre_ids: [10763], vote_count: 9000 }),
      credit({ poster_path: null, vote_count: 9000 }),
      credit({ character: "Smaug", vote_count: 2000 }),
    ]);
    expect(ranked.map((c) => c.character)).toEqual(["Smaug", "Alan Turing"]);
  });
});

describe("unseen", () => {
  it("drops watched/listed titles and duplicates, keeping series and movies with the same id apart", () => {
    const items = [
      { type: "SERIES" as const, tmdbId: 1 },
      { type: "MOVIE" as const, tmdbId: 1 },
      { type: "SERIES" as const, tmdbId: 2 },
      { type: "SERIES" as const, tmdbId: 2 },
    ];
    expect(unseen(items, new Set(["SERIES-1"]))).toEqual([
      { type: "MOVIE", tmdbId: 1 },
      { type: "SERIES", tmdbId: 2 },
    ]);
  });
});
