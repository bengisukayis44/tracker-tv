import Link from "next/link";
import { after } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { Discover, TitleRow } from "@/components/discover";
import { WatchLists } from "@/components/profile/watch-lists";
import { SearchBox } from "@/components/search-box";
import { Button } from "@/components/ui/button";
import { getDiscoverLists, refreshSeries } from "@/lib/catalog";
import { getMostDiscussed } from "@/lib/comment-data";
import { getRecommendations } from "@/lib/recommendations";
import { getContinueWatching, getUpcoming, getWatchlist, staleTrackedSeries } from "@/lib/profile";

export default async function HomePage() {
  const user = await getCurrentUser();
  const [personal, recommendations, discover, discussed] = await Promise.all([
    user
      ? Promise.all([
          getContinueWatching(user.id),
          getUpcoming(user.id),
          getWatchlist(user.id),
          staleTrackedSeries(user.id),
        ])
      : null,
    user ? getRecommendations(user.id) : [],
    getDiscoverLists(),
    getMostDiscussed(),
  ]);
  const stale = personal?.[3] ?? [];
  if (stale.length) after(() => Promise.all(stale.map(refreshSeries)));

  return (
    <div className="space-y-12">
      <section className="mx-auto max-w-2xl space-y-6 py-12 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          {user ? `Hoş geldin, @${user.username}` : "İzlediklerini takip et"}
        </h1>
        <p className="text-muted-foreground">
          Dizi ve filmlerini takip et, bölümleri puanla, hislerini kaydet ve spoiler korumalı yorumları oku.
        </p>
        <form action="/search" role="search" className="mx-auto flex max-w-lg gap-2">
          <SearchBox placeholder="Dizi, film, oyuncu ya da kullanıcı ara…" ariaLabel="Dizi ya da film ara" />
          <Button type="submit" size="lg" className="h-10">
            Ara
          </Button>
        </form>
        {!user && (
          <div className="flex justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/register">Hemen başla</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Giriş yap</Link>
            </Button>
          </div>
        )}
      </section>

      {personal && (
        <WatchLists continueWatching={personal[0]} upcoming={personal[1]} watchlist={personal[2]} limit={6} />
      )}
      {recommendations.map((row) => (
        <TitleRow key={row.id} id={`rec-${row.id}`} title={row.title} reason={row.reason} items={row.items} />
      ))}
      <Discover lists={discover} discussed={discussed} />
    </div>
  );
}
