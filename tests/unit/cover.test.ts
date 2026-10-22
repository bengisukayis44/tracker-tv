import { beforeEach, describe, expect, it, vi } from "vitest";
import { imagePathOf, isImagePath, orderCoverImages, type TmdbBackdrop } from "@/lib/cover";

const { db, auth, tmdbMock } = vi.hoisted(() => ({
  db: {
    watchedEpisode: { findFirst: vi.fn() },
    watchedMovie: { findFirst: vi.fn() },
    episode: { findMany: vi.fn() },
    user: { update: vi.fn() },
  },
  auth: { getCurrentUser: vi.fn() },
  tmdbMock: { backdrops: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => auth);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tmdb", () => ({ tmdb: tmdbMock }));

const { getCoverImages, setCover } = await import("@/app/actions/cover");

const backdrop = (file_path: string, over: Partial<TmdbBackdrop> = {}): TmdbBackdrop => ({
  file_path,
  iso_639_1: null,
  vote_average: 5,
  width: 1920,
  height: 1080,
  ...over,
});

describe("orderCoverImages", () => {
  it("puts textless images first, then the best rated", () => {
    expect(
      orderCoverImages([
        backdrop("/en.jpg", { iso_639_1: "en", vote_average: 9 }),
        backdrop("/low.jpg", { vote_average: 3 }),
        backdrop("/high.jpg", { vote_average: 8 }),
      ]),
    ).toEqual(["/high.jpg", "/low.jpg", "/en.jpg"]);
  });

  it("keeps every usable image but leaves out small, tall, duplicate and odd entries", () => {
    const many = Array.from({ length: 150 }, (_, i) => backdrop(`/b${i}.jpg`));
    expect(orderCoverImages(many)).toHaveLength(150);
    expect(
      orderCoverImages([
        backdrop("/small.jpg", { width: 780, height: 439 }),
        backdrop("/tall.jpg", { width: 1920, height: 1920 }),
        backdrop("/ok.jpg"),
        backdrop("/ok.jpg"),
        backdrop("../hack.jpg"),
      ]),
    ).toEqual(["/ok.jpg"]);
  });

  it("reads the image path out of a stored still URL", () => {
    expect(imagePathOf("https://image.tmdb.org/t/p/w780/abc_D-1.jpg")).toBe("/abc_D-1.jpg");
    expect(imagePathOf("https://evil.example/t/p/w780/abc.jpg")).toBeNull();
    expect(imagePathOf(null)).toBeNull();
  });

  it("only accepts TMDB-style image paths", () => {
    expect(isImagePath("/AbC123_-x.jpg")).toBe(true);
    for (const bad of ["https://evil.example/x.jpg", "/../x.jpg", "/x.svg", "", null])
      expect(isImagePath(bad)).toBe(false);
  });
});

describe("setCover", () => {
  const sherlock = { type: "SERIES", tmdbId: 19885 } as const;

  beforeEach(() => {
    vi.clearAllMocks();
    auth.getCurrentUser.mockResolvedValue({ id: "me", username: "ben", email: "b@example.com", avatarUrl: null });
    db.watchedEpisode.findFirst.mockResolvedValue({ id: "w" });
    tmdbMock.backdrops.mockResolvedValue([backdrop("/sahne.jpg")]);
    // Stored episodes come in any order; specials (season 0) go last
    db.episode.findMany.mockResolvedValue([
      {
        episodeNumber: 1,
        name: "Özel",
        stillUrl: "https://image.tmdb.org/t/p/w780/ozel.jpg",
        season: { seasonNumber: 0 },
      },
      {
        episodeNumber: 2,
        name: "Kör Bankacı",
        stillUrl: "https://image.tmdb.org/t/p/w780/kare2.jpg",
        season: { seasonNumber: 1 },
      },
      {
        episodeNumber: 1,
        name: "Pembe",
        stillUrl: "https://image.tmdb.org/t/p/w780/kare1.jpg",
        season: { seasonNumber: 1 },
      },
    ]);
  });

  it("offers the series' images and its episode stills in viewing order", async () => {
    expect(await getCoverImages(sherlock)).toEqual({
      ok: true,
      scenes: ["/sahne.jpg"],
      stills: [
        { path: "/kare1.jpg", label: "S01E01 · Pembe" },
        { path: "/kare2.jpg", label: "S01E02 · Kör Bankacı" },
        { path: "/ozel.jpg", label: "S00E01 · Özel" },
      ],
    });
  });

  it("accepts an episode still of the series as the cover", async () => {
    expect(await setCover({ ...sherlock, path: "/kare2.jpg" })).toEqual({ ok: true });
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: "me" }, data: { coverPath: "/kare2.jpg" } });
  });

  it("saves an image TMDB lists for a series the user watched", async () => {
    expect(await setCover({ ...sherlock, path: "/sahne.jpg" })).toEqual({ ok: true });
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: "me" }, data: { coverPath: "/sahne.jpg" } });
  });

  it("refuses unwatched titles and images that are not offered for it", async () => {
    expect(await setCover({ ...sherlock, path: "/baska.jpg" })).toMatchObject({ ok: false });
    db.watchedEpisode.findFirst.mockResolvedValue(null);
    expect(await setCover({ ...sherlock, path: "/sahne.jpg" })).toMatchObject({ ok: false });
    expect(db.user.update).not.toHaveBeenCalled();
  });
});
