import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  chunk,
  cleanText,
  isPlaceholderEpisodeName,
  mergeEpisodeTranslation,
  tmdb,
  TmdbError,
  tmdbImage,
  tmdbRating,
  type TmdbEpisode,
} from "@/lib/tmdb";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

const episode = (n: number, name: string, overview = ""): TmdbEpisode => ({
  id: 1000 + n,
  season_number: 1,
  episode_number: n,
  name,
  overview,
  air_date: "2010-07-25",
  runtime: 88,
  still_path: null,
  vote_average: 8,
  vote_count: 10,
});

beforeEach(() => {
  vi.stubEnv("TMDB_API_KEY", "test-token");
});

describe("helpers", () => {
  it("recognises placeholder episode names in Turkish and English", () => {
    for (const name of ["3. Bölüm", "3.Bölüm", "Bölüm 3", "Episode 12", "", null]) {
      expect(isPlaceholderEpisodeName(name)).toBe(true);
    }
    for (const name of ["Pembe Üzerine Bir Çalışma", "Episode 12: The Return", "Pilot"]) {
      expect(isPlaceholderEpisodeName(name)).toBe(false);
    }
  });

  it("keeps Turkish text and only falls back to English where Turkish is missing", () => {
    expect(
      mergeEpisodeTranslation(episode(1, "Kör Bankacı", "Türkçe özet"), episode(1, "The Blind Banker", "EN")),
    ).toMatchObject({
      name: "Kör Bankacı",
      overview: "Türkçe özet",
    });
    expect(
      mergeEpisodeTranslation(episode(2, "2. Bölüm"), episode(2, "Many Happy Returns", "EN overview")),
    ).toMatchObject({
      name: "Many Happy Returns",
      overview: "EN overview",
    });
    // English is a placeholder too: keep the Turkish one
    expect(mergeEpisodeTranslation(episode(3, "3. Bölüm"), episode(3, "Episode 3"))).toMatchObject({
      name: "3. Bölüm",
    });
    expect(mergeEpisodeTranslation(episode(4, "4. Bölüm"), undefined).name).toBe("4. Bölüm");
  });

  it("builds image URLs and ratings", () => {
    expect(tmdbImage("/abc.jpg", "w500")).toBe("https://image.tmdb.org/t/p/w500/abc.jpg");
    expect(tmdbImage(null, "w500")).toBeNull();
    expect(tmdbRating(8.504, 1200)).toBe(8.5);
    expect(tmdbRating(0, 0)).toBeNull();
    expect(tmdbRating(7, 0)).toBeNull();
  });

  it("removes invisible direction marks and empty text", () => {
    expect(cleanText("\u200eOfis\u200e")).toBe("Ofis");
    expect(cleanText("  Dram ")).toBe("Dram");
    expect(cleanText("\u200f  ")).toBeNull();
    expect(cleanText(null)).toBeNull();
  });

  it("chunks lists", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 20)).toEqual([]);
  });
});

describe("tmdb client", () => {
  it("sends the bearer token and Turkish language", async () => {
    const fetchMock = vi.fn(async () => json({ results: [{ id: 19885, name: "Sherlock" }] }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await tmdb.searchTv("sherlock")).toEqual([{ id: 19885, name: "Sherlock" }]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.pathname).toBe("/3/search/tv");
    expect(url.searchParams.get("query")).toBe("sherlock");
    expect(url.searchParams.get("language")).toBe("tr-TR");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
  });

  it("fetches seasons 20 at a time in Turkish and English and merges them", async () => {
    const seasons = Array.from({ length: 22 }, (_, i) => ({
      season_number: i,
      name: `S${i}`,
      poster_path: null,
      episode_count: 1,
    }));
    const fetchMock = vi.fn(async (input: URL) => {
      const append = input.searchParams.get("append_to_response") ?? "";
      const lang = input.searchParams.get("language");
      if (append.startsWith("external_ids")) {
        return json({
          id: 1,
          name: "Uzun Dizi",
          overview: "",
          status: "Ended",
          seasons,
          translations: { translations: [{ iso_639_1: "en", data: { overview: "English overview" } }] },
        });
      }
      const body: Record<string, unknown> = {};
      for (const key of append.split(",")) {
        const n = Number(key.split("/")[1]);
        body[key] = {
          season_number: n,
          name: `S${n}`,
          poster_path: null,
          episodes: [episode(1, lang === "tr-TR" ? "1. Bölüm" : `English ${n}`)],
        };
      }
      return json(body);
    });
    vi.stubGlobal("fetch", fetchMock);

    const show = await tmdb.getTvWithSeasons(1);
    // 1 details request + 2 batches × 2 languages
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(show.seasonsWithEpisodes).toHaveLength(22);
    expect(show.seasonsWithEpisodes[21].episodes[0].name).toBe("English 21");
    expect(show.overview).toBe("English overview");
  });

  it("leaves people out of mixed search results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json({
          results: [
            { media_type: "person", id: 1 },
            { media_type: "movie", id: 2 },
            { media_type: "tv", id: 3 },
          ],
        }),
      ),
    );
    expect((await tmdb.searchMulti("x")).map((r) => r.media_type)).toEqual(["movie", "tv"]);
  });

  it("falls back to the English overview for untranslated movies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json({
          id: 1,
          title: "Film",
          overview: "",
          genres: [],
          translations: { translations: [{ iso_639_1: "en", data: { overview: "English" } }] },
        }),
      ),
    );
    expect((await tmdb.getMovie(1)).overview).toBe("English");
  });

  it("reports 404s and retries server errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({}, 404)),
    );
    await expect(tmdb.findTvByImdbId("tt0")).rejects.toMatchObject({ name: "TmdbError", status: 404 });

    vi.useFakeTimers();
    const flaky = vi
      .fn()
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(json({ tv_results: [{ id: 7 }] }));
    vi.stubGlobal("fetch", flaky);
    const promise = tmdb.findTvByImdbId("tt1");
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe(7);
    vi.useRealTimers();
  });

  it("marks timeouts and fails clearly without a token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Object.assign(new Error("timeout"), { name: "TimeoutError" })));
    await expect(tmdb.searchTv("x", { retries: 0 })).rejects.toMatchObject({ timedOut: true });

    vi.stubEnv("TMDB_API_KEY", "");
    await expect(tmdb.searchTv("x")).rejects.toBeInstanceOf(TmdbError);
  });
});
