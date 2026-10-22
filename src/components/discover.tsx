import Image from "next/image";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { PosterCard } from "@/components/poster-card";
import { titleHref, type DiscoverLists, type SearchResult } from "@/lib/catalog";
import type { DiscussedItem } from "@/lib/comment-data";
import { genreLabel, pickRating } from "@/lib/format";

/**
 * Keşfet on the home page: this week's popular series and movies, what is in Turkish cinemas (TMDB) and
 * the episodes and movies people comment on most here. Empty lists are left out.
 */
export function Discover({ lists, discussed }: { lists: DiscoverLists; discussed: DiscussedItem[] }) {
  return (
    <>
      {discussed.length > 0 && (
        <Row id="discover-discussed" title="En çok konuşulanlar">
          {discussed.map((item) => (
            <li key={item.key} className="w-64 shrink-0">
              <Link
                href={item.href}
                className="bg-card hover:border-primary/40 flex h-full items-center gap-3 rounded-xl border p-3 transition-colors"
              >
                <span className="bg-muted relative aspect-[2/3] w-12 shrink-0 overflow-hidden rounded-md">
                  {item.posterUrl && <Image src={item.posterUrl} alt="" fill sizes="48px" className="object-cover" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-bold">{item.name}</span>
                  <span className="text-muted-foreground line-clamp-2 text-xs">{item.detail}</span>
                  <span className="text-primary mt-1 inline-flex items-center gap-1 text-xs font-semibold">
                    <MessageSquare className="size-3" />
                    {item.comments} yorum
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </Row>
      )}
      <TitleRow id="discover-series" title="Bu hafta popüler diziler" items={lists.popularSeries} />
      <TitleRow id="discover-movies" title="Bu hafta popüler filmler" items={lists.popularMovies} />
      <TitleRow id="discover-cinemas" title="Vizyonda" items={lists.inCinemas} />
    </>
  );
}

function TitleRow({ id, title, items }: { id: string; title: string; items: SearchResult[] }) {
  if (items.length === 0) return null;
  return (
    <Row id={id} title={title}>
      {items.map((item) => (
        <li key={`${item.type}-${item.tmdbId}`} className="w-36 shrink-0 sm:w-40">
          <PosterCard
            href={titleHref(item.type, item.tmdbId)}
            title={item.name}
            posterUrl={item.posterUrl}
            rating={pickRating(item.imdbRating, item.sourceRating)}
            subtitle={[item.year, item.genres[0] && genreLabel(item.genres[0])].filter(Boolean).join(" · ")}
          />
        </li>
      ))}
    </Row>
  );
}

/** A titled row that scrolls sideways. */
function Row({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <h2 id={id} className="text-xl font-bold">
        {title}
      </h2>
      <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">{children}</ul>
    </section>
  );
}
