import type { Metadata } from "next";
import { CastList } from "@/components/cast-list";
import { CommentSection } from "@/components/comments/comment-section";
import { CommunityStats } from "@/components/community-stats";
import { TitleHero } from "@/components/title-hero";
import { WatchProviders } from "@/components/watch-providers";
import { TitlePreparing } from "@/components/title-preparing";
import { TitleActions } from "@/components/watch/title-actions";
import { WatchPanel } from "@/components/watch/watch-panel";
import { getCurrentUser } from "@/lib/auth";
import { parseCast } from "@/lib/cast";
import { parseProviders } from "@/lib/providers";
import { isAired } from "@/lib/episodes";
import { formatDate, formatRuntime, pickRating, statusLabel } from "@/lib/format";
import { getComments } from "@/lib/comment-data";
import { getCommunityStats } from "@/lib/community-data";
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

  const commentTarget = { kind: "movie", titleId: movie.id } as const;
  const [[viewer, watch], comments, community] = await Promise.all([
    user ? Promise.all([getTitleViewerState(user.id, movie.id), getMovieWatch(user.id, movie.id)]) : [null, null],
    getComments(commentTarget, user?.id ?? null),
    getCommunityStats(commentTarget),
  ]);
  const released = isAired({ airDate: movie.releaseDate });
  const cast = parseCast(movie.castMembers);

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
          titleName={movie.name}
          isFavorite={viewer?.isFavorite ?? false}
          inWatchlist={viewer?.inWatchlist ?? false}
          signedIn={user !== null}
        />
      </TitleHero>

      <WatchProviders providers={parseProviders(movie.watchProviders)} />

      <CastList cast={cast} />

      <div className="mx-auto max-w-4xl space-y-8">
        <WatchPanel
          target={{ kind: "movie", titleId: movie.id }}
          aired={released}
          signedIn={user !== null}
          watch={watch}
          cast={cast}
        />
        <CommunityStats stats={community} cast={cast} />
        <CommentSection
          target={commentTarget}
          comments={comments}
          signedIn={user !== null}
          spoilersRevealed={watch !== null}
        />
      </div>
    </div>
  );
}
