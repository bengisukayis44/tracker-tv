import { describe, expect, it } from "vitest";
import {
  CAST_LIMIT,
  castFromAggregate,
  castFromCredits,
  characterLabel,
  parseCast,
} from "@/lib/cast";

describe("castFromAggregate (series)", () => {
  it("keeps TMDB's order, builds photo URLs and joins several roles, most-seen first", () => {
    const cast = castFromAggregate([
      {
        id: 71580,
        name: "Benedict Cumberbatch",
        profile_path: "/b.jpg",
        roles: [{ character: "Sherlock Holmes", episode_count: 12 }],
      },
      {
        id: 2,
        name: " Tatiana Maslany ",
        profile_path: null,
        roles: [
          { character: "Cosima", episode_count: 3 },
          { character: "Sarah", episode_count: 10 },
          { character: "", episode_count: 1 },
        ],
      },
      { id: 3, name: "Rolsüz", profile_path: null, roles: [] },
    ]);
    expect(cast).toEqual([
      {
        id: 71580,
        name: "Benedict Cumberbatch",
        character: "Sherlock Holmes",
        profileUrl: "https://image.tmdb.org/t/p/w185/b.jpg",
      },
      {
        id: 2,
        name: "Tatiana Maslany",
        character: "Sarah / Cosima",
        profileUrl: null,
      },
      { id: 3, name: "Rolsüz", character: null, profileUrl: null },
    ]);
  });

  it(`keeps at most ${CAST_LIMIT} people`, () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      id: i + 1,
      name: `Oyuncu ${i}`,
      profile_path: null,
      roles: [],
    }));
    expect(castFromAggregate(many)).toHaveLength(CAST_LIMIT);
  });
});

describe("castFromCredits (movie)", () => {
  it("maps actor and character, empty characters become null", () => {
    expect(
      castFromCredits([
        {
          id: 6193,
          name: "Leonardo DiCaprio",
          profile_path: "/l.jpg",
          character: "Dom Cobb",
        },
        { id: 9, name: "Figüran", profile_path: null, character: " " },
      ]),
    ).toEqual([
      {
        id: 6193,
        name: "Leonardo DiCaprio",
        character: "Dom Cobb",
        profileUrl: "https://image.tmdb.org/t/p/w185/l.jpg",
      },
      { id: 9, name: "Figüran", character: null, profileUrl: null },
    ]);
  });
});

describe("parseCast and characterLabel", () => {
  it("reads stored cast and drops malformed entries", () => {
    const good = { id: 1, name: "A", character: "B", profileUrl: null };
    expect(parseCast([good, { id: "x" }, null, "a"])).toEqual([good]);
    expect(parseCast(null)).toEqual([]);
  });

  it("falls back to the actor's name when the character is unknown", () => {
    expect(characterLabel({ name: "Oyuncu", character: "Karakter" })).toBe(
      "Karakter",
    );
    expect(characterLabel({ name: "Oyuncu", character: null })).toBe("Oyuncu");
  });
});
