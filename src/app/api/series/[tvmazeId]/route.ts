import { NextResponse } from "next/server";
import { getSeries } from "@/lib/catalog";
import { TvmazeError } from "@/lib/tvmaze";

// GET /api/series/335 — series with seasons and episodes, served from the database cache
export async function GET(_request: Request, { params }: { params: Promise<{ tvmazeId: string }> }) {
  const tvmazeId = Number((await params).tvmazeId);
  if (!Number.isInteger(tvmazeId) || tvmazeId <= 0) {
    return NextResponse.json({ error: "Geçersiz dizi kimliği." }, { status: 400 });
  }

  try {
    return NextResponse.json(await getSeries(tvmazeId));
  } catch (error) {
    if (error instanceof TvmazeError && error.status === 404) {
      return NextResponse.json({ error: "Dizi bulunamadı." }, { status: 404 });
    }
    console.error("Dizi yüklenemedi:", error);
    return NextResponse.json({ error: "Dizi şu anda yüklenemiyor." }, { status: 502 });
  }
}
