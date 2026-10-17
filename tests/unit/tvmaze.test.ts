import { afterEach, describe, expect, it, vi } from "vitest";
import { pickBackdrop, stripHtml, tvmaze, TvmazeError, type TvmazeShowImage } from "@/lib/tvmaze";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  vi.useRealTimers();
});

describe("stripHtml", () => {
  it("removes tags and decodes common entities", () => {
    expect(stripHtml("<p><b>Sherlock</b> &amp; Watson&#39;s &quot;cases&quot;&nbsp;</p>")).toBe(
      `Sherlock & Watson's "cases"`,
    );
  });

  it("returns null for empty input", () => {
    expect(stripHtml(null)).toBeNull();
    expect(stripHtml("<p> </p>")).toBeNull();
  });
});

describe("pickBackdrop", () => {
  const img = (id: number, type: string, main: boolean, width?: number): TvmazeShowImage => ({
    id,
    type,
    main,
    resolutions: { original: { url: `https://img/${id}.jpg`, width } },
  });

  it("prefers the main background, then the widest one, and ignores posters", () => {
    expect(
      pickBackdrop([img(1, "poster", true, 2000), img(2, "background", false, 1920), img(3, "background", true, 640)]),
    ).toBe("https://img/3.jpg");
    expect(pickBackdrop([img(1, "background", false, 640), img(2, "background", false, 1920)])).toBe(
      "https://img/2.jpg",
    );
  });

  it("returns null without backgrounds", () => {
    expect(pickBackdrop(undefined)).toBeNull();
    expect(pickBackdrop([img(1, "poster", true)])).toBeNull();
  });
});

describe("tvmaze client", () => {
  it("assembles a show from separate endpoints", async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      const path = new URL(url).pathname;
      if (path === "/shows/1") return json({ id: 1, name: "Test" });
      if (path === "/shows/1/episodes") return json([{ id: 10 }]);
      if (path === "/shows/1/seasons") return json([{ id: 20 }]);
      if (path === "/shows/1/images") return json([{ id: 30 }]);
      return json({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const show = await tvmaze.getShowWithEpisodes(1);
    expect(show.name).toBe("Test");
    expect(show._embedded).toEqual({ episodes: [{ id: 10 }], seasons: [{ id: 20 }], images: [{ id: 30 }] });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("still returns the show when only the images request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const path = new URL(url).pathname;
        if (path === "/shows/1/images") return json({}, 404);
        return json(path === "/shows/1" ? { id: 1 } : []);
      }),
    );
    const show = await tvmaze.getShowWithEpisodes(1);
    expect(show._embedded?.images).toEqual([]);
  });

  it("throws a TvmazeError with the status for unknown shows", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({}, 404)),
    );
    await expect(tvmaze.getShowWithEpisodes(999)).rejects.toMatchObject({ name: "TvmazeError", status: 404 });
    await expect(tvmaze.getShowWithEpisodes(999)).rejects.toBeInstanceOf(TvmazeError);
  });

  it("retries a gateway error", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({}, 502))
      .mockResolvedValueOnce(json([{ score: 1, show: { id: 5 } }]));
    vi.stubGlobal("fetch", fetchMock);

    const promise = tvmaze.searchShows("x");
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toEqual([{ id: 5 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after two gateway retries", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => json({}, 503));
    vi.stubGlobal("fetch", fetchMock);

    const promise = tvmaze.searchShows("x");
    const assertion = expect(promise).rejects.toMatchObject({ status: 503 });
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("backs off and retries on rate limiting", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({}, 429))
      .mockResolvedValueOnce(json({}, 429))
      .mockResolvedValueOnce(json([]));
    vi.stubGlobal("fetch", fetchMock);

    const promise = tvmaze.searchShows("x");
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retries connection failures and then reports them as TvmazeError", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(json([]));
    vi.stubGlobal("fetch", fetchMock);

    const ok = tvmaze.searchShows("x");
    await vi.runAllTimersAsync();
    await expect(ok).resolves.toEqual([]);

    const failing = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", failing);
    const promise = tvmaze.searchShows("x");
    const assertion = expect(promise).rejects.toBeInstanceOf(TvmazeError);
    await vi.runAllTimersAsync();
    await assertion;
    expect(failing).toHaveBeenCalledTimes(3);
  });

  it("does not call the API for an empty query", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await tvmaze.searchShows("   ")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
