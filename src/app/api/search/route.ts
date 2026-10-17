import { after, NextResponse, type NextRequest } from "next/server";
import { refreshSearchCache, searchTitles } from "@/lib/catalog";

// GET /api/search?q=sherlock → { results, partial }
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ results: [], partial: false });

  try {
    const outcome = await searchTitles(q);
    if (outcome.partial) after(() => refreshSearchCache(q));
    return NextResponse.json(outcome);
  } catch (error) {
    console.error("Arama başarısız:", error);
    return NextResponse.json({ error: "Arama şu anda yapılamıyor." }, { status: 502 });
  }
}
