import { after, NextResponse, type NextRequest } from "next/server";
import { refreshSearchCache, searchTitles, type SearchKind } from "@/lib/catalog";

const KINDS: SearchKind[] = ["all", "series", "movie"];

// GET /api/search?q=sherlock&kind=all|series|movie → { results, partial }
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const kindParam = request.nextUrl.searchParams.get("kind") as SearchKind | null;
  const kind: SearchKind = kindParam && KINDS.includes(kindParam) ? kindParam : "all";
  if (!q) return NextResponse.json({ results: [], partial: false });

  try {
    const outcome = await searchTitles(q, kind);
    if (outcome.partial) after(() => refreshSearchCache(q, kind));
    return NextResponse.json(outcome);
  } catch (error) {
    console.error("Arama başarısız:", error);
    return NextResponse.json({ error: "Arama şu anda yapılamıyor." }, { status: 502 });
  }
}
