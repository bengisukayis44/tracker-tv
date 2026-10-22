import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { AlertCircle, Clock, Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PosterCard } from "@/components/poster-card";
import { UserChip } from "@/components/social/user-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { refreshSearchCache, searchTitles, titleHref, type SearchKind, type SearchResult } from "@/lib/catalog";
import { genreLabel, pickRating, statusLabel } from "@/lib/format";
import { searchUsers } from "@/lib/social";
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

  const kind: SearchKind = filter === "dizi" ? "series" : filter === "film" ? "movie" : "all";
  let results: SearchResult[] = [];
  let partial = false;
  let error = false;
  if (q) {
    try {
      ({ results, partial } = await searchTitles(q, kind));
      // The data source was too slow: finish the search after the response so the next try has full results
      if (partial) after(() => refreshSearchCache(q, kind));
    } catch (err) {
      console.error("Arama başarısız:", err);
      error = true;
    }
  }
  const retryHref = filterHref(q, filter);
  // People too, on the unfiltered search
  const users = q && filter === "hepsi" ? await searchUsers(q) : [];

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

      {users.length > 0 && (
        <section aria-labelledby="user-results" className="space-y-3">
          <h2 id="user-results" className="text-lg font-bold">
            Kullanıcılar
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {users.map((u) => (
              <UserChip key={u.username} user={u} />
            ))}
          </div>
        </section>
      )}

      {!q ? (
        <EmptyState icon={<Search />} title="Aramaya başla" text="Yukarıdaki kutuya bir dizi ya da film adı yaz." />
      ) : error ? (
        <EmptyState
          icon={<AlertCircle className="text-destructive" />}
          title="Arama yapılamadı"
          text="Veri kaynağına şu anda ulaşılamıyor. Biraz sonra tekrar dene."
        />
      ) : partial && results.length === 0 ? (
        <div className="space-y-4 text-center">
          <EmptyState
            icon={<Clock />}
            title="Veri kaynağı şu an yavaş"
            text="Arama arka planda sürüyor. Birkaç saniye sonra tekrar dene; sonuçlar hazır olacak."
          />
          <Button asChild variant="outline">
            <Link href={retryHref}>Tekrar dene</Link>
          </Button>
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title="Sonuç bulunamadı"
          text={`"${q}" için ${filter === "dizi" ? "bir dizi" : filter === "film" ? "bir film" : "bir dizi ya da film"} bulamadık. Farklı bir yazım dene.`}
        />
      ) : (
        <section className="space-y-4">
          {partial && (
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200"
            >
              <span className="inline-flex items-center gap-2">
                <Clock className="size-4 shrink-0" />
                Veri kaynağı yavaş yanıt veriyor; şimdilik kayıtlı diziler gösteriliyor. Tam sonuçlar birazdan hazır.
              </span>
              <Link href={retryHref} className="font-semibold underline underline-offset-4">
                Tekrar dene
              </Link>
            </div>
          )}
          <p className="text-muted-foreground text-sm">
            &ldquo;{q}&rdquo; için {results.length} sonuç
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {results.map((r) => (
              <PosterCard
                key={`${r.type}:${r.tmdbId}`}
                href={titleHref(r.type, r.tmdbId)}
                title={r.name}
                posterUrl={r.posterUrl}
                rating={pickRating(r.imdbRating, r.sourceRating)}
                badge={r.type === "MOVIE" ? "Film" : "Dizi"}
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
