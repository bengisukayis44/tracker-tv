import type { TmdbMultiSearchItem } from "@/lib/tmdb";

/** One line in the type-ahead list under a search box. */
export type Suggestion = {
  kind: "series" | "movie" | "person" | "user";
  href: string;
  name: string;
  /** "Dizi · 2010", "Oyuncu · Sherlock, Doctor Strange", "Kullanıcı" */
  detail: string;
  imageUrl: string | null;
};

export const SUGGEST_TITLES = 5;
export const SUGGEST_PEOPLE = 3;

const image = (path: string | null | undefined) => (path ? `https://image.tmdb.org/t/p/w92${path}` : null);
const year = (date: string | undefined) => (date ? date.slice(0, 4) : null);

/** The best series/movies and actors from a multi search, plus matching users, in that order. */
export function buildSuggestions(
  results: TmdbMultiSearchItem[],
  users: { username: string; avatarUrl: string | null }[],
): Suggestion[] {
  const titles: Suggestion[] = [];
  const people: Suggestion[] = [];
  for (const r of results) {
    if (r.media_type === "tv" && titles.length < SUGGEST_TITLES) {
      titles.push({
        kind: "series",
        href: `/series/${r.id}`,
        name: r.name,
        detail: ["Dizi", year(r.first_air_date)].filter(Boolean).join(" · "),
        imageUrl: image(r.poster_path),
      });
    } else if (r.media_type === "movie" && titles.length < SUGGEST_TITLES) {
      titles.push({
        kind: "movie",
        href: `/movie/${r.id}`,
        name: r.title,
        detail: ["Film", year(r.release_date)].filter(Boolean).join(" · "),
        imageUrl: image(r.poster_path),
      });
    } else if (r.media_type === "person" && r.known_for_department === "Acting" && people.length < SUGGEST_PEOPLE) {
      const known = (r.known_for ?? [])
        .map((k) => ("name" in k ? k.name : "title" in k ? k.title : null))
        .filter(Boolean)
        .slice(0, 2);
      people.push({
        kind: "person",
        href: `/person/${r.id}`,
        name: r.name,
        detail: ["Oyuncu", known.join(", ")].filter(Boolean).join(" · "),
        imageUrl: image(r.profile_path),
      });
    }
  }
  const members: Suggestion[] = users.map((u) => ({
    kind: "user",
    href: `/profile/${u.username}`,
    name: `@${u.username}`,
    detail: "Kullanıcı",
    imageUrl: u.avatarUrl,
  }));
  return [...titles, ...people, ...members];
}
