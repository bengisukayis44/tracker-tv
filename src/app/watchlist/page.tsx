import type { Metadata } from "next";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { WatchLists } from "@/components/profile/watch-lists";
import { getCurrentUser } from "@/lib/auth";
import { refreshSeries } from "@/lib/catalog";
import { getContinueWatching, getUpcoming, getWatchlist, staleTrackedSeries } from "@/lib/profile";

export const metadata: Metadata = { title: "İzleme listem" };

/** PROJE_PLANI.md §4.8: "İzlemeye devam et", "Yakında" and "Daha sonra izle". */
export default async function WatchlistPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent("/watchlist")}`);

  const [continueWatching, upcoming, watchlist, stale] = await Promise.all([
    getContinueWatching(user.id),
    getUpcoming(user.id),
    getWatchlist(user.id),
    staleTrackedSeries(user.id),
  ]);
  // New episodes and air dates come in from TMDB for the next visit
  if (stale.length) after(() => Promise.all(stale.map(refreshSeries)));

  return (
    <div className="space-y-10">
      <h1 className="text-3xl font-extrabold tracking-tight">İzleme listem</h1>
      <WatchLists continueWatching={continueWatching} upcoming={upcoming} watchlist={watchlist} />
    </div>
  );
}
