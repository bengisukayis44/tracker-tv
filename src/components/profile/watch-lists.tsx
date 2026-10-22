import Link from "next/link";
import { ArrowRight, Bookmark, CalendarClock, PlayCircle } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PosterCard } from "@/components/poster-card";
import type { getContinueWatching, getUpcoming, getWatchlist } from "@/lib/profile";
import { ContinueWatchingCard } from "./continue-watching-card";
import { UpcomingCard } from "./upcoming-card";
import { WatchlistRemoveButton } from "./watchlist-remove-button";

type Props = {
  continueWatching: Awaited<ReturnType<typeof getContinueWatching>>;
  upcoming: Awaited<ReturnType<typeof getUpcoming>>;
  watchlist: Awaited<ReturnType<typeof getWatchlist>>;
  /** Home page: at most this many per list, empty lists hidden, with a link to /watchlist */
  limit?: number;
};

/**
 * "İzlemeye devam et", "Yakında" and "Daha sonra izle" (PROJE_PLANI.md §4.8), on /watchlist and the home page.
 * Series on the watch-later list show up under "İzlemeye devam et" from their first episode (or under
 * "Yakında" before they start), so "Daha sonra izle" only lists what is not shown above.
 */
export function WatchLists({ continueWatching, upcoming, watchlist, limit }: Props) {
  const shown = new Set([...continueWatching.map((s) => s.id), ...upcoming.map((u) => u.key)]);
  const later = watchlist.filter((w) => !shown.has(w.title.id));
  const cut = <T,>(list: T[]) => (limit ? list.slice(0, limit) : list);
  const compact = limit !== undefined;

  return (
    <>
      {(!compact || continueWatching.length > 0) && (
        <Section id="continue-heading" title="İzlemeye devam et" more={compact}>
          {continueWatching.length === 0 ? (
            <EmptyState
              icon={<PlayCircle />}
              title="Yarım kalan dizi yok"
              text="Bir diziden bölüm izledikçe ya da listene dizi ekledikçe sıradaki bölüm burada görünür."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {cut(continueWatching).map((s) => (
                <ContinueWatchingCard key={s.id} series={s} />
              ))}
            </div>
          )}
        </Section>
      )}

      {(!compact || upcoming.length > 0) && (
        <Section id="upcoming-heading" title="Yakında" more={compact}>
          {upcoming.length === 0 ? (
            <EmptyState
              icon={<CalendarClock />}
              title="Yaklaşan bölüm yok"
              text="Takip ettiğin dizilerin yeni bölümleri tarihi belli olunca burada geri sayımla görünür."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {cut(upcoming).map((item) => (
                <UpcomingCard key={item.key} item={item} />
              ))}
            </div>
          )}
        </Section>
      )}

      {(!compact || later.length > 0) && (
        <Section id="later-heading" title="Daha sonra izle" more={compact}>
          {later.length === 0 ? (
            <EmptyState
              icon={<Bookmark />}
              title="Liste boş"
              text="Dizi ve film sayfalarındaki “Daha sonra izle” ile buraya ekleyebilirsin."
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {cut(later).map((w) => (
                <div key={w.title.id} className="space-y-1">
                  <PosterCard
                    href={w.title.type === "MOVIE" ? `/movie/${w.title.tmdbId}` : `/series/${w.title.tmdbId}`}
                    title={w.title.name}
                    posterUrl={w.title.posterUrl}
                    badge={w.title.type === "MOVIE" ? "Film" : "Dizi"}
                  />
                  {!compact && <WatchlistRemoveButton titleId={w.title.id} name={w.title.name} />}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}
    </>
  );
}

function Section({
  id,
  title,
  more,
  children,
}: {
  id: string;
  title: string;
  /** Show a link to the full list */
  more: boolean;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="text-xl font-bold">
          {title}
        </h2>
        {more && (
          <Link
            href="/watchlist"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm font-semibold"
          >
            İzleme listem
            <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
