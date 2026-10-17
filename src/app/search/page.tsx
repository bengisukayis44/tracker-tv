import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, Clapperboard, Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PosterCard } from "@/components/poster-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchTitles, type SearchResult } from "@/lib/catalog";
import { genreLabel, statusLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Ara" };

const FILTERS = [
  { value: "hepsi", label: "Hepsi" },
  { value: "dizi", label: "Dizi" },
  { value: "film", label: "Film" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];

function filterHref(q: string, filter: Filter) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (filter !== "hepsi") params.set("tur", filter);
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; tur?: string }> }) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const filter: Filter = FILTERS.some((f) => f.value === params.tur) ? (params.tur as Filter) : "hepsi";

  // The current source (TVmaze) has series only, so the movie filter returns nothing yet
  let results: SearchResult[] = [];
  let error = false;
  if (q && filter !== "film") {
    try {
      results = await searchTitles(q);
    } catch (err) {
      console.error("Arama başarısız:", err);
      error = true;
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight">Ara</h1>
        <p className="text-muted-foreground">Takip etmek istediğin dizi ve filmleri bul.</p>
      </div>

      <div className="space-y-4">
        <form action="/search" className="flex max-w-2xl gap-2" role="search">
          {filter !== "hepsi" && <input type="hidden" name="tur" value={filter} />}
          <div className="relative flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Dizi veya film adı… (ör. Breaking Bad)"
              aria-label="Arama"
              className="h-10 pl-9"
              autoFocus={!q}
            />
          </div>
          <Button type="submit" size="lg" className="h-10">
            Ara
          </Button>
        </form>

        <nav aria-label="Tür filtresi" className="bg-muted inline-flex rounded-lg p-1">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={filterHref(q, f.value)}
              aria-current={filter === f.value ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                filter === f.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </Link>
          ))}
        </nav>
      </div>

      {!q ? (
        <EmptyState icon={<Search />} title="Aramaya başla" text="Yukarıdaki kutuya bir dizi adı yaz." />
      ) : filter === "film" ? (
        <EmptyState
          icon={<Clapperboard />}
          title="Film araması yakında"
          text="Şu anki veri kaynağımız (TVmaze) yalnızca dizileri içeriyor. Filmler TMDB entegrasyonuyla gelecek."
        />
      ) : error ? (
        <EmptyState
          icon={<AlertCircle className="text-destructive" />}
          title="Arama yapılamadı"
          text="Veri kaynağına şu anda ulaşılamıyor. Biraz sonra tekrar dene."
        />
      ) : results.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title="Sonuç bulunamadı"
          text={`"${q}" için bir dizi bulamadık. Farklı bir yazım dene.`}
        />
      ) : (
        <section className="space-y-4">
          <p className="text-muted-foreground text-sm">
            &ldquo;{q}&rdquo; için {results.length} sonuç
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {results.map((r) => (
              <PosterCard
                key={r.tvmazeId}
                href={`/series/${r.tvmazeId}`}
                title={r.name}
                posterUrl={r.posterUrl}
                rating={r.sourceRating}
                badge="Dizi"
                subtitle={[r.year, statusLabel(r.status), r.genres[0] && genreLabel(r.genres[0])]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
