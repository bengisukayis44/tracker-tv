import Link from "next/link";
import { after } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { WatchLists } from "@/components/profile/watch-lists";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { refreshSeries } from "@/lib/catalog";
import { getContinueWatching, getUpcoming, getWatchlist, staleTrackedSeries } from "@/lib/profile";

export default async function HomePage() {
  const user = await getCurrentUser();
  const [continueWatching, upcoming, watchlist, stale] = user
    ? await Promise.all([
        getContinueWatching(user.id),
        getUpcoming(user.id),
        getWatchlist(user.id),
        staleTrackedSeries(user.id),
      ])
    : [[], [], [], []];
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
          <Input
            name="q"
            placeholder="Bir dizi ya da film ara… (ör. Sherlock)"
            aria-label="Dizi ya da film ara"
            className="h-10"
          />
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

      {user && <WatchLists continueWatching={continueWatching} upcoming={upcoming} watchlist={watchlist} limit={6} />}
    </div>
  );
}

