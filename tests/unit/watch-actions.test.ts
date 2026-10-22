import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-ins for the database, the session and Next's cache
const { db, auth } = vi.hoisted(() => ({
  db: {
    title: { findFirst: vi.fn() },
    watchedMovie: { upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    watchlistItem: { deleteMany: vi.fn() },
  },
  auth: { getCurrentUser: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => auth);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { addRewatch, saveMovieWatch, undoRewatch } = await import("@/app/actions/watch");

const cast = [
  { id: 6193, name: "Leonardo DiCaprio", character: "Dom Cobb", profileUrl: null },
  { id: 9, name: "İsimsiz Rol", character: null, profileUrl: null },
];
const entry = { titleId: "m1", rating: null, emotions: [], note: null };

describe("saveMovieWatch: favorite character", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.getCurrentUser.mockResolvedValue({ id: "me", username: "ben", email: "b@example.com", avatarUrl: null });
    db.title.findFirst.mockResolvedValue({
      id: "m1",
      tmdbId: 27205,
      releaseDate: new Date("2010-07-16"),
      castMembers: cast,
    });
  });

  const saved = () => db.watchedMovie.upsert.mock.calls[0][0].create;

  it("stores the character name from the movie's own cast", async () => {
    expect(await saveMovieWatch({ ...entry, favoriteCastId: 6193 })).toEqual({ ok: true });
    expect(saved()).toMatchObject({ favoriteCastId: 6193, favoriteCharacter: "Dom Cobb" });
  });

  it("uses the actor's name when the character is unknown, and clears with null", async () => {
    await saveMovieWatch({ ...entry, favoriteCastId: 9 });
    expect(saved()).toMatchObject({ favoriteCastId: 9, favoriteCharacter: "İsimsiz Rol" });
    vi.clearAllMocks();
    await saveMovieWatch({ ...entry, favoriteCastId: null });
    expect(saved()).toMatchObject({ favoriteCastId: null, favoriteCharacter: null });
  });

  it("refuses someone who is not in the cast", async () => {
    expect(await saveMovieWatch({ ...entry, favoriteCastId: 12345 })).toMatchObject({ ok: false });
    expect(db.watchedMovie.upsert).not.toHaveBeenCalled();
  });
});

describe("rewatches", () => {
  const movie = { kind: "movie", titleId: "m1" } as const;
  const earlier = new Date("2026-01-01T20:00:00Z");

  beforeEach(() => {
    vi.clearAllMocks();
    auth.getCurrentUser.mockResolvedValue({ id: "me", username: "ben", email: "b@example.com", avatarUrl: null });
    db.title.findFirst.mockResolvedValue({
      id: "m1",
      tmdbId: 27205,
      releaseDate: new Date("2010-07-16"),
      castMembers: [],
    });
  });

  const saved = () => db.watchedMovie.update.mock.calls[0][0].data.rewatchedAt as Date[];

  it("adds a dated rewatch and counts the first watch too", async () => {
    db.watchedMovie.findUnique.mockResolvedValue({ id: "w1", rewatchedAt: [earlier] });
    expect(await addRewatch(movie)).toEqual({ ok: true, watchCount: 3 });
    expect(saved()).toHaveLength(2);
    expect(saved()[0]).toEqual(earlier);
  });

  it("takes back only the latest rewatch", async () => {
    db.watchedMovie.findUnique.mockResolvedValue({ id: "w1", rewatchedAt: [earlier, new Date()] });
    expect(await undoRewatch(movie)).toEqual({ ok: true, watchCount: 2 });
    expect(saved()).toEqual([earlier]);
  });

  it("needs a watch first", async () => {
    db.watchedMovie.findUnique.mockResolvedValue(null);
    expect(await addRewatch(movie)).toMatchObject({ ok: false });
    expect(db.watchedMovie.update).not.toHaveBeenCalled();
  });
});
