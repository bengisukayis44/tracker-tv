import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { PosterCard } from "@/components/poster-card";
import { ContinueWatchingCard } from "@/components/profile/continue-watching-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getContinueWatching, getWatchlist } from "@/lib/profile";

// How much of each list the home page shows; the rest is on /watchlist
const CONTINUE_LIMIT = 6;
const WATCHLIST_LIMIT = 6;

export default async function HomePage() {
  const user = await getCurrentUser();
  const [continueWatching, watchlist] = user
    ? await Promise.all([getContinueWatching(user.id), getWatchlist(user.id)])
    : [[], []];

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

      {continueWatching.length > 0 && (
        <HomeSection id="home-continue" title="İzlemeye devam et" more={continueWatching.length > CONTINUE_LIMIT}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {continueWatching.slice(0, CONTINUE_LIMIT).map((s) => (
              <ContinueWatchingCard key={s.id} series={s} />
            ))}
          </div>
        </HomeSection>
      )}

      {watchlist.length > 0 && (
        <HomeSection id="home-later" title="Daha sonra izle" more={watchlist.length > WATCHLIST_LIMIT}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {watchlist.slice(0, WATCHLIST_LIMIT).map((w) => (
              <PosterCard
                key={w.title.id}
                href={w.title.type === "MOVIE" ? `/movie/${w.title.tmdbId}` : `/series/${w.title.tmdbId}`}
                title={w.title.name}
                posterUrl={w.title.posterUrl}
                badge={w.title.type === "MOVIE" ? "Film" : "Dizi"}
              />
            ))}
          </div>
        </HomeSection>
      )}
    </div>
  );
}

function HomeSection({
  id,
  title,
  more,
  children,
}: {
  id: string;
  title: string;
  /** Some items are only on /watchlist */
  more: boolean;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="text-xl font-bold">
          {title}
        </h2>
        <Link
          href="/watchlist"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm font-semibold"
        >
          {more ? "Tümünü gör" : "İzleme listem"}
          <ArrowRight className="size-4" />
        </Link>
      </div>
      {children}
    </section>
  );
}
