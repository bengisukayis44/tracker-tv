import { describe, expect, it } from "vitest";
import { summarizeCommunity, type CommunityRow } from "@/lib/community";
import { parseProviders, providersFromTmdb } from "@/lib/providers";

const row = (over: Partial<CommunityRow> = {}): CommunityRow => ({
  rating: null,
  emotions: [],
  favoriteCastId: null,
  favoriteCharacter: null,
  ...over,
});

describe("summarizeCommunity", () => {
  it("is empty when nobody watched", () => {
    expect(summarizeCommunity([])).toEqual({
      watchers: 0,
      ratingCount: 0,
      averageRating: null,
      emotions: [],
      characters: [],
    });
  });

  it("averages only the given ratings, to one decimal", () => {
    const stats = summarizeCommunity([row({ rating: 9 }), row({ rating: 8 }), row({ rating: 8 }), row()]);
    expect(stats).toMatchObject({ watchers: 4, ratingCount: 3, averageRating: 8.3 });
  });

  it("gives each emotion's share of viewers, most picked first", () => {
    const stats = summarizeCommunity([
      row({ emotions: ["GERGIN", "SASKIN"] }),
      row({ emotions: ["SASKIN"] }),
      row({ emotions: ["SASKIN", "MUTLU"] }),
      row(),
    ]);
    expect(stats.emotions.map((e) => [e.label, e.count, e.percent])).toEqual([
      ["Şaşkın", 3, 75],
      ["Mutlu", 1, 25],
      ["Gergin", 1, 25],
    ]);
  });

  it("ranks characters by votes (share of those who picked one), at most five", () => {
    const pick = (id: number, name: string) => row({ favoriteCastId: id, favoriteCharacter: name });
    const stats = summarizeCommunity([
      pick(1, "Sherlock Holmes"),
      pick(1, "Sherlock Holmes"),
      pick(2, "John Watson"),
      pick(3, "Mrs. Hudson"),
      pick(4, "Molly Hooper"),
      pick(5, "Mycroft Holmes"),
      pick(6, "Jim Moriarty"),
      row(),
    ]);
    expect(stats.characters).toHaveLength(5);
    expect(stats.characters[0]).toEqual({ castId: 1, character: "Sherlock Holmes", count: 2, percent: 29 });
    // Ties are alphabetical
    expect(stats.characters.slice(1).map((c) => c.character)).toEqual([
      "Jim Moriarty",
      "John Watson",
      "Molly Hooper",
      "Mrs. Hudson",
    ]);
  });
});

describe("providersFromTmdb", () => {
  const provider = (id: number, name: string, priority: number) => ({
    provider_id: id,
    provider_name: name,
    logo_path: `/${id}.png`,
    display_priority: priority,
  });

  it("keeps Turkey's providers, grouped and in JustWatch's order", () => {
    const providers = providersFromTmdb({
      results: {
        US: { flatrate: [provider(15, "Hulu", 1)] },
        TR: {
          link: "https://www.themoviedb.org/movie/27205-inception/watch?locale=TR",
          buy: [provider(2, "Apple TV Store", 5)],
          flatrate: [provider(1899, "HBO Max", 9), provider(8, "Netflix", 0)],
        },
      },
    });
    expect(providers.link).toContain("locale=TR");
    expect(providers.groups.map((g) => [g.label, g.providers.map((p) => p.name)])).toEqual([
      ["Abonelikle", ["Netflix", "HBO Max"]],
      ["Satın al", ["Apple TV Store"]],
    ]);
    expect(providers.groups[0].providers[0].logoUrl).toBe("https://image.tmdb.org/t/p/w92/8.png");
  });

  it("is empty (but fetched) when Turkey has no providers", () => {
    expect(providersFromTmdb({ results: { US: {} } })).toEqual({ link: null, groups: [] });
    expect(providersFromTmdb(undefined)).toEqual({ link: null, groups: [] });
  });

  it("reads stored values back, null when never fetched", () => {
    expect(parseProviders({ link: null, groups: [] })).toEqual({ link: null, groups: [] });
    expect(parseProviders(null)).toBeNull();
    expect(parseProviders({ link: "x" })).toBeNull();
  });
});
