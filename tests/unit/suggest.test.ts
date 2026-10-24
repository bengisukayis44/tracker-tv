import { describe, expect, it } from "vitest";
import { buildSuggestions } from "@/lib/suggest";
import type { TmdbMultiSearchItem } from "@/lib/tmdb";

const tv = (id: number, name: string): TmdbMultiSearchItem => ({
  media_type: "tv",
  id,
  name,
  overview: "",
  poster_path: "/p.jpg",
  first_air_date: "2010-07-25",
  vote_average: 8,
  vote_count: 100,
  genre_ids: [],
});

describe("buildSuggestions", () => {
  it("puts titles first, then actors, then users", () => {
    const results: TmdbMultiSearchItem[] = [
      {
        media_type: "person",
        id: 71580,
        name: "Benedict Cumberbatch",
        profile_path: null,
        known_for_department: "Acting",
        popularity: 30,
        known_for: [
          { media_type: "tv", name: "Sherlock" },
          { media_type: "movie", title: "Doctor Strange" },
          { media_type: "movie", title: "The Imitation Game" },
        ],
      },
      tv(19885, "Sherlock"),
      {
        media_type: "movie",
        id: 27205,
        title: "Başlangıç",
        overview: "",
        poster_path: null,
        release_date: "",
        vote_average: 8,
        vote_count: 1,
        genre_ids: [],
      },
    ];
    expect(buildSuggestions(results, [{ username: "sherlockfan", avatarUrl: null }])).toEqual([
      {
        kind: "series",
        href: "/series/19885",
        name: "Sherlock",
        detail: "Dizi · 2010",
        imageUrl: "https://image.tmdb.org/t/p/w92/p.jpg",
      },
      { kind: "movie", href: "/movie/27205", name: "Başlangıç", detail: "Film", imageUrl: null },
      {
        kind: "person",
        href: "/person/71580",
        name: "Benedict Cumberbatch",
        detail: "Oyuncu · Sherlock, Doctor Strange",
        imageUrl: null,
      },
      { kind: "user", href: "/profile/sherlockfan", name: "@sherlockfan", detail: "Kullanıcı", imageUrl: null },
    ]);
  });

  it("keeps at most 5 titles and leaves out crew", () => {
    const results: TmdbMultiSearchItem[] = [
      ...Array.from({ length: 8 }, (_, i) => tv(i + 1, `Dizi ${i + 1}`)),
      {
        media_type: "person",
        id: 9,
        name: "Yönetmen",
        profile_path: null,
        known_for_department: "Directing",
        popularity: 1,
      },
    ];
    const out = buildSuggestions(results, []);
    expect(out.map((s) => s.name)).toEqual(["Dizi 1", "Dizi 2", "Dizi 3", "Dizi 4", "Dizi 5"]);
  });
});
