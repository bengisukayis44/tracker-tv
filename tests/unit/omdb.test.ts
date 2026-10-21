import { beforeEach, describe, expect, it, vi } from "vitest";
import { isOmdbEnabled, omdb, OmdbError, parseImdbRating } from "@/lib/omdb";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  vi.stubEnv("OMDB_API_KEY", "test-key");
});

describe("parseImdbRating", () => {
  it("parses valid ratings and rejects N/A or out-of-range values", () => {
    expect(parseImdbRating("8.7")).toBe(8.7);
    expect(parseImdbRating("10")).toBe(10);
    expect(parseImdbRating("N/A")).toBeNull();
    expect(parseImdbRating("11")).toBeNull();
    expect(parseImdbRating(undefined)).toBeNull();
  });
});

describe("isOmdbEnabled", () => {
  it("depends on the API key", () => {
    expect(isOmdbEnabled()).toBe(true);
    vi.stubEnv("OMDB_API_KEY", "");
    expect(isOmdbEnabled()).toBe(false);
  });
});

describe("omdb client", () => {
  it("sends the key and IMDb id and returns the rating", async () => {
    const fetchMock = vi.fn(async () =>
      json({ Response: "True", imdbRating: "9.1" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await omdb.getTitleRating("tt1475582")).toBe(9.1);
    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]));
    expect(url.searchParams.get("i")).toBe("tt1475582");
    expect(url.searchParams.get("apikey")).toBe("test-key");
  });

  it("maps season episodes and drops unparseable episode numbers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json({
          Response: "True",
          Episodes: [
            { Episode: "1", imdbRating: "8.0", imdbID: "tt1" },
            { Episode: "2", imdbRating: "N/A", imdbID: "tt2" },
            { Episode: "x", imdbRating: "7.0", imdbID: "tt3" },
          ],
        }),
      ),
    );
    expect(await omdb.getSeasonRatings("tt0", 1)).toEqual([
      { episode: 1, imdbId: "tt1", rating: 8 },
      { episode: 2, imdbId: "tt2", rating: null },
    ]);
  });

  it("treats an unknown season as having no ratings", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json({ Response: "False", Error: "Series or season not found!" }),
      ),
    );
    expect(await omdb.getSeasonRatings("tt0", 99)).toEqual([]);
  });

  it.each([
    ["Request limit reached!", "limit"],
    ["Invalid API key!", "auth"],
    ["Incorrect IMDb ID.", "not_found"],
  ])("classifies the error %s", async (message, kind) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ Response: "False", Error: message }, 401)),
    );
    await expect(omdb.getTitleRating("tt0")).rejects.toMatchObject({ kind });
  });

  it("fails clearly without a key and never calls the API", async () => {
    vi.stubEnv("OMDB_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(omdb.getTitleRating("tt0")).rejects.toBeInstanceOf(OmdbError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
