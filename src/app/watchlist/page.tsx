import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Bookmark, PlayCircle } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PosterCard } from "@/components/poster-card";
import { ContinueWatchingCard } from "@/components/profile/continue-watching-card";
import { WatchlistRemoveButton } from "@/components/profile/watchlist-remove-button";
import { getCurrentUser } from "@/lib/auth";
import { getContinueWatching, getWatchlist } from "@/lib/profile";

export const metadata: Metadata = { title: "İzleme listem" };

/** PROJE_PLANI.md §4.8: "İzlemeye devam et" and "Daha sonra izle". */
export default async function WatchlistPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent("/watchlist")}`);

  const [continueWatching, watchlist] = await Promise.all([getContinueWatching(user.id), getWatchlist(user.id)]);

  return (
    <div className="space-y-10">
      <h1 className="text-3xl font-extrabold tracking-tight">İzleme listem</h1>

      <section aria-labelledby="continue-heading" className="space-y-4">
        <h2 id="continue-heading" className="text-xl font-bold">
          İzlemeye devam et
        </h2>
        {continueWatching.length === 0 ? (
          <EmptyState
            icon={<PlayCircle />}
            title="Yarım kalan dizi yok"
            text="Bir diziden bölüm izledikçe kaldığın yer ve sıradaki bölüm burada görünür."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {continueWatching.map((s) => (
              <ContinueWatchingCard key={s.id} series={s} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="later-heading" className="space-y-4">
        <h2 id="later-heading" className="text-xl font-bold">
          Daha sonra izle
        </h2>
        {watchlist.length === 0 ? (
          <EmptyState
            icon={<Bookmark />}
            title="Liste boş"
            text="Dizi ve film sayfalarındaki “Daha sonra izle” ile buraya ekleyebilirsin."
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {watchlist.map((w) => (
              <div key={w.title.id} className="space-y-1">
                <PosterCard
                  href={w.title.type === "MOVIE" ? `/movie/${w.title.tmdbId}` : `/series/${w.title.tmdbId}`}
                  title={w.title.name}
                  posterUrl={w.title.posterUrl}
                  badge={w.title.type === "MOVIE" ? "Film" : "Dizi"}
                />
                <WatchlistRemoveButton titleId={w.title.id} name={w.title.name} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
