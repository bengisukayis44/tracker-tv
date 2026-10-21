import { after, NextResponse } from "next/server";
import { lookupSeries, refreshSeries } from "@/lib/catalog";
import { TmdbError } from "@/lib/tmdb";

// GET /api/series/335 — series with seasons and episodes, served from the database cache
export async function GET(_request: Request, { params }: { params: Promise<{ tmdbId: string }> }) {
  const tmdbId = Number((await params).tmdbId);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return NextResponse.json({ error: "Geçersiz dizi kimliği." }, { status: 400 });
  }

  try {
    const lookup = await lookupSeries(tmdbId);
    if (lookup.status === "preparing" || lookup.stale) after(() => refreshSeries(tmdbId));
    if (lookup.status === "preparing") {
      return NextResponse.json({ status: "preparing" }, { status: 202, headers: { "Retry-After": "5" } });
    }
    return NextResponse.json(lookup.series);
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) {
      return NextResponse.json({ error: "Dizi bulunamadı." }, { status: 404 });
    }
    console.error("Dizi yüklenemedi:", error);
    return NextResponse.json({ error: "Dizi şu anda yüklenemiyor." }, { status: 502 });
  }
}
