import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-ins for the database and TVmaze
const { db, tvmazeMock } = vi.hoisted(() => ({
  db: {
    searchCache: { findUnique: vi.fn(), upsert: vi.fn() },
    title: { findMany: vi.fn(), findUnique: vi.fn() },
  },
  tvmazeMock: { searchShows: vi.fn(), getShowWithEpisodes: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/tvmaze", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tvmaze")>()),
  tvmaze: tvmazeMock,
}));

const { lookupSeries, normalizeQuery, refreshSearchCache, searchTitles } = await import("@/lib/catalog");
const { TvmazeError } = await import("@/lib/tvmaze");

const show = {
  id: 335,
  name: "Sherlock",
  genres: ["Drama"],
  status: "Ended",
  premiered: "2010-07-25",
  rating: { average: 8.9 },
};
const result = {
  tvmazeId: 335,
  type: "SERIES",
  name: "Sherlock",
  posterUrl: null,
  year: 2010,
  status: "Ended",
  sourceRating: 8.9,
  imdbRating: null,
  genres: ["Drama"],
  overview: null,
};
const timeout = () => new TvmazeError("TVmaze'e ulaşılamadı", undefined, true);

beforeEach(() => {
  vi.clearAllMocks();
  db.title.findMany.mockResolvedValue([]);
  db.searchCache.upsert.mockResolvedValue({});
});

describe("normalizeQuery", () => {
  it("trims, collapses spaces and lower-cases with Turkish rules", () => {
    expect(normalizeQuery("  The   Office ")).toBe("the office");
    expect(normalizeQuery("IŞIL")).toBe("ışıl");
  });
});

describe("searchTitles", () => {
  it("serves a fresh stored search without calling TVmaze", async () => {
    db.searchCache.findUnique.mockResolvedValue({ results: [result], fetchedAt: new Date() });
    const outcome = await searchTitles("Sherlock");
    expect(outcome).toEqual({ results: [result], partial: false });
    expect(tvmazeMock.searchShows).not.toHaveBeenCalled();
  });

  it("asks TVmaze with a short timeout and no retries, then stores the result", async () => {
    db.searchCache.findUnique.mockResolvedValue(null);
    tvmazeMock.searchShows.mockResolvedValue([show]);

    const outcome = await searchTitles("Sherlock");
    expect(outcome.partial).toBe(false);
    expect(outcome.results.map((r) => r.name)).toEqual(["Sherlock"]);
    expect(tvmazeMock.searchShows).toHaveBeenCalledWith("Sherlock", { timeoutMs: 4000, retries: 0 });
    expect(db.searchCache.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { query: "sherlock" } }));
  });

  it("falls back to stored series when TVmaze is too slow", async () => {
    db.searchCache.findUnique.mockResolvedValue(null);
    tvmazeMock.searchShows.mockRejectedValue(timeout());
    db.title.findMany.mockResolvedValueOnce([
      {
        tvmazeId: 335,
        name: "Sherlock",
        posterUrl: null,
        releaseDate: new Date("2010-07-25"),
        status: "Ended",
        sourceRating: 8.9,
        imdbRating: 9.1,
        genres: ["Drama"],
        overview: null,
      },
    ]);

    const outcome = await searchTitles("sherl");
    expect(outcome.partial).toBe(true);
    expect(outcome.results).toMatchObject([{ tvmazeId: 335, name: "Sherlock", year: 2010, imdbRating: 9.1 }]);
  });

  it("prefers an older stored search over the name fallback when TVmaze is slow", async () => {
    const old = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    db.searchCache.findUnique.mockResolvedValue({ results: [result], fetchedAt: old });
    tvmazeMock.searchShows.mockRejectedValue(timeout());

    const outcome = await searchTitles("Sherlock");
    expect(outcome).toEqual({ results: [result], partial: true });
  });

  it("finishes a slow search in the background with a long timeout and never throws", async () => {
    tvmazeMock.searchShows.mockResolvedValue([show]);
    await refreshSearchCache("Sherlock");
    expect(tvmazeMock.searchShows).toHaveBeenCalledWith("Sherlock", { timeoutMs: 60000, retries: 1 });
    expect(db.searchCache.upsert).toHaveBeenCalled();

    tvmazeMock.searchShows.mockRejectedValue(timeout());
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(refreshSearchCache("Sherlock")).resolves.toBeUndefined();
  });
});

describe("lookupSeries", () => {
  const stored = (lastSyncedAt: Date) => ({ id: "t1", tvmazeId: 335, status: "Ended", lastSyncedAt, seasons: [] });

  it("returns a stored series at once and flags it when it is due a refresh", async () => {
    db.title.findUnique.mockResolvedValue(stored(new Date()));
    expect(await lookupSeries(335)).toMatchObject({ status: "ready", stale: false });

    db.title.findUnique.mockResolvedValue(stored(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
    expect(await lookupSeries(335)).toMatchObject({ status: "ready", stale: true });
    expect(tvmazeMock.getShowWithEpisodes).not.toHaveBeenCalled();
  });

  it("reports 'preparing' when a never-opened series does not arrive in time", async () => {
    db.title.findUnique.mockResolvedValue(null);
    tvmazeMock.getShowWithEpisodes.mockRejectedValue(timeout());
    vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(await lookupSeries(42)).toEqual({ status: "preparing" });
    expect(tvmazeMock.getShowWithEpisodes).toHaveBeenCalledWith(42, { timeoutMs: 10000, retries: 0 });
  });

  it("still reports unknown shows as not found", async () => {
    db.title.findUnique.mockResolvedValue(null);
    tvmazeMock.getShowWithEpisodes.mockRejectedValue(new TvmazeError("yok", 404));
    await expect(lookupSeries(99999999)).rejects.toMatchObject({ status: 404 });
  });
});
