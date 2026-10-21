import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-ins for the database, the session and Next's cache
const { db, auth } = vi.hoisted(() => ({
  db: {
    title: { findFirst: vi.fn() },
    watchedMovie: { upsert: vi.fn() },
    watchlistItem: { deleteMany: vi.fn() },
  },
  auth: { getCurrentUser: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => auth);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { saveMovieWatch } = await import("@/app/actions/watch");

const cast = [
  { id: 6193, name: "Leonardo DiCaprio", character: "Dom Cobb", profileUrl: null },
  { id: 9, name: "İsimsiz Rol", character: null, profileUrl: null },
];
const entry = { titleId: "m1", rating: null, emotions: [], note: null };

describe("saveMovieWatch: favorite character", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.getCurrentUser.mockResolvedValue({ id: "me", username: "ben", email: "b@example.com", avatarUrl: null });
    db.title.findFirst.mockResolvedValue({ id: "m1", tmdbId: 27205, releaseDate: new Date("2010-07-16"), castMembers: cast });
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
