import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-ins for the database and TMDB
const { db, tmdbMock } = vi.hoisted(() => ({
  db: {
    searchCache: { findUnique: vi.fn(), upsert: vi.fn() },
    title: { findMany: vi.fn(), findFirst: vi.fn() },
  },
  tmdbMock: { searchTv: vi.fn(), tvGenres: vi.fn(), getTvWithSeasons: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/tmdb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tmdb")>()),
  tmdb: tmdbMock,
}));

const { airDateFromTmdb, averageRuntime, lookupSeries, normalizeQuery, refreshSearchCache, searchTitles } =
  await import("@/lib/catalog");
const { TmdbError } = await import("@/lib/tmdb");

const item = {
  id: 19885,
  name: "‎Sherlock",
  overview: "Özet",
  poster_path: "/p.jpg",
  first_air_date: "2010-07-25",
  vote_average: 8.504,
  vote_count: 100,
  genre_ids: [80, 18, 999],
};
const result = {
  tmdbId: 19885,
  type: "SERIES",
  name: "Sherlock",
  posterUrl: "https://image.tmdb.org/t/p/w342/p.jpg",
  year: 2010,
  status: null,
  sourceRating: 8.5,
  imdbRating: null,
  genres: ["Suç", "Dram"],
  overview: "Özet",
};
const timeout = () => new TmdbError("TMDB'ye ulaşılamadı", undefined, true);

beforeEach(() => {
  vi.clearAllMocks();
  db.title.findMany.mockResolvedValue([]);
  db.searchCache.upsert.mockResolvedValue({});
  tmdbMock.tvGenres.mockResolvedValue(
    new Map([
      [80, "Suç"],
      [18, "Dram"],
    ]),
  );
});

describe("normalizeQuery", () => {
  it("trims, collapses spaces and lower-cases with Turkish rules", () => {
    expect(normalizeQuery("  The   Office ")).toBe("the office");
    expect(normalizeQuery("IŞIL")).toBe("ışıl");
  });
});

describe("searchTitles", () => {
  it("serves a fresh stored search without calling TMDB", async () => {
    db.searchCache.findUnique.mockResolvedValue({ results: [result], fetchedAt: new Date() });
    expect(await searchTitles("Sherlock")).toEqual({ results: [result], partial: false });
    expect(tmdbMock.searchTv).not.toHaveBeenCalled();
  });

  it("asks TMDB with a short timeout, maps genres and images, and stores the result", async () => {
    db.searchCache.findUnique.mockResolvedValue(null);
    tmdbMock.searchTv.mockResolvedValue([item]);

    const outcome = await searchTitles("Sherlock");
    expect(outcome).toEqual({ results: [result], partial: false });
    expect(tmdbMock.searchTv).toHaveBeenCalledWith("Sherlock", { timeoutMs: 4000, retries: 0 });
    expect(db.searchCache.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { query: "sherlock" } }));
  });

  it("still returns results when the genre list cannot be loaded", async () => {
    db.searchCache.findUnique.mockResolvedValue(null);
    tmdbMock.searchTv.mockResolvedValue([item]);
    tmdbMock.tvGenres.mockRejectedValue(timeout());
    expect((await searchTitles("Sherlock")).results[0].genres).toEqual([]);
  });

  it("falls back to stored series when TMDB is too slow", async () => {
    db.searchCache.findUnique.mockResolvedValue(null);
    tmdbMock.searchTv.mockRejectedValue(timeout());
    vi.spyOn(console, "warn").mockImplementation(() => {});
    db.title.findMany.mockResolvedValueOnce([
      {
        tmdbId: 19885,
        name: "Sherlock",
        posterUrl: null,
        releaseDate: new Date("2010-07-25"),
        status: "Ended",
        sourceRating: 8.5,
        imdbRating: 9.1,
        genres: ["Dram"],
        overview: null,
      },
    ]);

    const outcome = await searchTitles("sherl");
    expect(outcome.partial).toBe(true);
    expect(outcome.results).toMatchObject([{ tmdbId: 19885, name: "Sherlock", year: 2010, imdbRating: 9.1 }]);
  });

  it("prefers an older stored search over the name fallback when TMDB is slow", async () => {
    const old = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    db.searchCache.findUnique.mockResolvedValue({ results: [result], fetchedAt: old });
    tmdbMock.searchTv.mockRejectedValue(timeout());
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await searchTitles("Sherlock")).toEqual({ results: [result], partial: true });
  });

  it("finishes a slow search in the background with a long timeout and never throws", async () => {
    tmdbMock.searchTv.mockResolvedValue([item]);
    await refreshSearchCache("Sherlock");
    expect(tmdbMock.searchTv).toHaveBeenCalledWith("Sherlock", { timeoutMs: 60000, retries: 1 });
    expect(db.searchCache.upsert).toHaveBeenCalled();

    tmdbMock.searchTv.mockRejectedValue(timeout());
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(refreshSearchCache("Sherlock")).resolves.toBeUndefined();
  });
});

describe("lookupSeries", () => {
  const stored = (lastSyncedAt: Date) => ({ id: "t1", tmdbId: 19885, status: "Ended", lastSyncedAt, seasons: [] });

  it("returns a stored series at once and flags it when it is due a refresh", async () => {
    db.title.findFirst.mockResolvedValue(stored(new Date()));
    expect(await lookupSeries(19885)).toMatchObject({ status: "ready", stale: false });
    expect(db.title.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tmdbId: 19885, type: "SERIES" } }),
    );

    db.title.findFirst.mockResolvedValue(stored(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
    expect(await lookupSeries(19885)).toMatchObject({ status: "ready", stale: true });
    expect(tmdbMock.getTvWithSeasons).not.toHaveBeenCalled();
  });

  it("reports 'preparing' when a never-opened series does not arrive in time", async () => {
    db.title.findFirst.mockResolvedValue(null);
    tmdbMock.getTvWithSeasons.mockRejectedValue(timeout());
    vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(await lookupSeries(42)).toEqual({ status: "preparing" });
    expect(tmdbMock.getTvWithSeasons).toHaveBeenCalledWith(42, { timeoutMs: 10000, retries: 0 });
  });

  it("still reports unknown shows as not found", async () => {
    db.title.findFirst.mockResolvedValue(null);
    tmdbMock.getTvWithSeasons.mockRejectedValue(new TmdbError("yok", 404));
    await expect(lookupSeries(99999999)).rejects.toMatchObject({ status: 404 });
  });
});

describe("storing helpers", () => {
  it("uses TMDB's runtime when given, otherwise the episodes' average", () => {
    expect(averageRuntime({ episode_run_time: [90], seasonsWithEpisodes: [] })).toBe(90);
    const seasons = [
      {
        season_number: 1,
        name: "",
        poster_path: null,
        episodes: [{ runtime: 40 }, { runtime: 50 }, { runtime: null }],
      },
    ];
    expect(averageRuntime({ episode_run_time: [], seasonsWithEpisodes: seasons as never })).toBe(45);
    expect(averageRuntime({ episode_run_time: [], seasonsWithEpisodes: [] })).toBeNull();
  });

  it("stores date-only air dates as midnight UTC", () => {
    expect(airDateFromTmdb("2010-07-25")).toBe("2010-07-25T00:00:00.000Z");
    expect(airDateFromTmdb(null)).toBeNull();
  });
});
