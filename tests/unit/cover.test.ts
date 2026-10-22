import { beforeEach, describe, expect, it, vi } from "vitest";
import { COVER_CHOICES, isImagePath, pickCoverImages, type TmdbBackdrop } from "@/lib/cover";

const { db, auth, tmdbMock } = vi.hoisted(() => ({
  db: {
    watchedEpisode: { findFirst: vi.fn() },
    watchedMovie: { findFirst: vi.fn() },
    user: { update: vi.fn() },
  },
  auth: { getCurrentUser: vi.fn() },
  tmdbMock: { backdrops: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => auth);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tmdb", () => ({ tmdb: tmdbMock }));

const { setCover } = await import("@/app/actions/cover");

const backdrop = (file_path: string, over: Partial<TmdbBackdrop> = {}): TmdbBackdrop => ({
  file_path,
  iso_639_1: null,
  vote_average: 5,
  width: 1920,
  height: 1080,
  ...over,
});

describe("pickCoverImages", () => {
  it("puts textless images first, then the best rated", () => {
    expect(
      pickCoverImages([
        backdrop("/en.jpg", { iso_639_1: "en", vote_average: 9 }),
        backdrop("/low.jpg", { vote_average: 3 }),
        backdrop("/high.jpg", { vote_average: 8 }),
      ]),
    ).toEqual(["/high.jpg", "/low.jpg", "/en.jpg"]);
  });

  it("leaves out small, tall, duplicate and odd entries and keeps at most ten", () => {
    const many = Array.from({ length: 15 }, (_, i) => backdrop(`/b${i}.jpg`));
    expect(pickCoverImages(many)).toHaveLength(COVER_CHOICES);
    expect(
      pickCoverImages([
        backdrop("/small.jpg", { width: 780, height: 439 }),
        backdrop("/tall.jpg", { width: 1920, height: 1920 }),
        backdrop("/ok.jpg"),
        backdrop("/ok.jpg"),
        backdrop("../hack.jpg"),
      ]),
    ).toEqual(["/ok.jpg"]);
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
