import { NextResponse, type NextRequest } from "next/server";
import { searchTitles } from "@/lib/catalog";

// GET /api/search?q=sherlock
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ results: [] });

  try {
    return NextResponse.json({ results: await searchTitles(q) });
  } catch (error) {
    console.error("Arama başarısız:", error);
    return NextResponse.json({ error: "Arama şu anda yapılamıyor." }, { status: 502 });
  }
}
