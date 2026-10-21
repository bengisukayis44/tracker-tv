import type { Metadata } from "next";
import { TitleHero } from "@/components/title-hero";
import { TitlePreparing } from "@/components/title-preparing";
import { TitleActions } from "@/components/watch/title-actions";
import { WatchPanel } from "@/components/watch/watch-panel";
import { getCurrentUser } from "@/lib/auth";
import { isAired } from "@/lib/episodes";
import { formatDate, formatRuntime, pickRating, statusLabel } from "@/lib/format";
import { getMovieWatch, getTitleViewerState } from "@/lib/viewer";
import { loadMovie } from "./data";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const movie = await loadMovie((await params).id);
  if (!movie) return { title: "Film hazırlanıyor" };
  const year = movie.releaseDate?.getFullYear();
  return { title: year ? `${movie.name} (${year})` : movie.name, description: movie.overview ?? undefined };
}

export default async function MoviePage({ params }: Props) {
  const { id } = await params;
  const [movie, user] = await Promise.all([loadMovie(id), getCurrentUser()]);
  if (!movie) return <TitlePreparing kind="movie" />;

  const [viewer, watch] = user
    ? await Promise.all([getTitleViewerState(user.id, movie.id), getMovieWatch(user.id, movie.id)])
    : [null, null];
  const released = isAired({ airDate: movie.releaseDate });

  return (
    <div className="space-y-8">
      <TitleHero
        name={movie.name}
        posterUrl={movie.posterUrl}
        backdropUrl={movie.backdropUrl}
        facts={[
          movie.releaseDate?.getFullYear(),
          // Only worth saying when it is not out yet
          !released && (statusLabel(movie.status) ?? "Yakında"),
          !released && movie.releaseDate && `Vizyon: ${formatDate(movie.releaseDate)}`,
          formatRuntime(movie.runtime),
        ]}
        rating={pickRating(movie.imdbRating, movie.sourceRating)}
        genres={movie.genres}
        overview={movie.overview}
        imdbId={movie.imdbId}
      >
        <TitleActions
          titleId={movie.id}
          isFavorite={viewer?.isFavorite ?? false}
          inWatchlist={viewer?.inWatchlist ?? false}
          signedIn={user !== null}
        />
      </TitleHero>

      <div className="mx-auto max-w-4xl">
        <WatchPanel
          target={{ kind: "movie", titleId: movie.id }}
          aired={released}
          signedIn={user !== null}
          watch={watch}
        />
      </div>
    </div>
  );
}
