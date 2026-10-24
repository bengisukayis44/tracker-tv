import { unstable_cache } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { searchUsers } from "@/lib/social";
import { buildSuggestions, SUGGEST_TITLES, type Suggestion } from "@/lib/suggest";
import { tmdb } from "@/lib/tmdb";

// Suggestions are for the moment of typing: a slow source is skipped rather than waited for
const multiSearch = unstable_cache((q: string) => tmdb.searchAll(q, { timeoutMs: 2_500, retries: 0 }), ["suggest-v1"], {
  revalidate: 24 * 60 * 60,
});

/** Titles already in our database, when TMDB does not answer in time. */
async function storedTitles(q: string): Promise<Suggestion[]> {
  const titles = await prisma.title.findMany({
    where: { tmdbId: { not: null }, name: { contains: q, mode: "insensitive" } },
    orderBy: [{ sourceRating: { sort: "desc", nulls: "last" } }, { name: "asc" }],
    take: SUGGEST_TITLES,
    select: { type: true, tmdbId: true, name: true, posterUrl: true, releaseDate: true },
  });
  return titles.map((t) => ({
    kind: t.type === "MOVIE" ? "movie" : "series",
    href: `/${t.type === "MOVIE" ? "movie" : "series"}/${t.tmdbId}`,
    name: t.name,
    detail: [t.type === "MOVIE" ? "Film" : "Dizi", t.releaseDate?.getUTCFullYear()].filter(Boolean).join(" · "),
    imageUrl: t.posterUrl ? t.posterUrl.replace(/\/w\d+\//, "/w92/") : null,
  }));
}

// GET /api/suggest?q=sher → { suggestions: Suggestion[] } (series/movies, actors, users)
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().toLocaleLowerCase("tr-TR").slice(0, 100);
  if (q.length < 2) return NextResponse.json({ suggestions: [] });

  const [multi, users] = await Promise.all([
    multiSearch(q).catch((error) => {
      console.warn(`Öneriler için TMDB yetişmedi ("${q}"):`, error);
      return null;
    }),
    searchUsers(q, 3),
  ]);
  const suggestions = multi
    ? buildSuggestions(multi, users)
    : [...(await storedTitles(q)), ...buildSuggestions([], users)];
  return NextResponse.json({ suggestions }, { headers: { "Cache-Control": "private, max-age=60" } });
}
