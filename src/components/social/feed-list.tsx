import Image from "next/image";
import Link from "next/link";
import { MessageSquare, Repeat, Star } from "lucide-react";
import { SpoilerBlur } from "@/components/comments/spoiler-blur";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { FeedItem } from "@/lib/feed";
import { episodeCode } from "@/lib/format";

const timeFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
});

/** The activity feed: who watched or wrote what, newest first. */
export function FeedList({ items }: { items: FeedItem[] }) {
  return (
    <ol className="space-y-3">
      {items.map((item, i) => (
        <li key={i}>
          <FeedRow item={item} />
        </li>
      ))}
    </ol>
  );
}

function FeedRow({ item }: { item: FeedItem }) {
  const profile = `/profile/${item.user.username}`;
  const who = (
    <Link href={profile} className="hover:text-primary font-bold">
      @{item.user.username}
    </Link>
  );

  let poster: string | null;
  let body: React.ReactNode;
  if (item.kind === "episode") {
    const first = item.episodes[0];
    const seriesHref = `/series/${item.series.tmdbId}`;
    const epHref = (e: typeof first) =>
      `${seriesHref}/season/${e.episode.seasonNumber}/episode/${e.episode.episodeNumber}`;
    poster = item.series.posterUrl;
    body =
      item.episodes.length === 1 ? (
        <p>
          {who}{" "}
          <Link href={seriesHref} className="hover:text-primary font-semibold">
            {item.series.name}
          </Link>{" "}
          <Link href={epHref(first)} className="hover:text-primary">
            {episodeCode(first.episode.seasonNumber, first.episode.episodeNumber)} · {first.episode.name}
          </Link>{" "}
          bölümünü {first.rewatch ? "tekrar izledi" : "izledi"}
          <Extras rating={first.rating} rewatch={first.rewatch} />
        </p>
      ) : (
        <p>
          {who}{" "}
          <Link href={seriesHref} className="hover:text-primary font-semibold">
            {item.series.name}
          </Link>{" "}
          dizisinden {item.episodes.length} bölüm izledi{" "}
          <span className="text-muted-foreground">
            ({episodeCode(first.episode.seasonNumber, first.episode.episodeNumber)}–
            {episodeCode(item.episodes.at(-1)!.episode.seasonNumber, item.episodes.at(-1)!.episode.episodeNumber)})
          </span>
        </p>
      );
  } else if (item.kind === "movie") {
    poster = item.movie.posterUrl;
    body = (
      <p>
        {who}{" "}
        <Link href={`/movie/${item.movie.tmdbId}`} className="hover:text-primary font-semibold">
          {item.movie.name}
        </Link>{" "}
        filmini {item.rewatch ? "tekrar izledi" : "izledi"}
        <Extras rating={item.rating} rewatch={item.rewatch} />
      </p>
    );
  } else {
    poster = item.where.posterUrl;
    const text = <p className="text-foreground/90 break-words whitespace-pre-wrap">{item.content}</p>;
    body = (
      <div className="space-y-2">
        <p>
          {who} <MessageSquare className="text-muted-foreground inline size-4" />{" "}
          <Link href={item.where.href} className="hover:text-primary font-semibold">
            {item.where.name}
            {item.where.detail && <span className="text-muted-foreground font-normal"> — {item.where.detail}</span>}
          </Link>{" "}
          için yorum yazdı
        </p>
        {item.isSpoiler ? <SpoilerBlur initiallyRevealed={false}>{text}</SpoilerBlur> : text}
      </div>
    );
  }

  return (
    <article className="bg-card flex gap-3 rounded-xl border p-3">
      <Link href={profile} aria-hidden tabIndex={-1} className="shrink-0">
        <Avatar>
          {item.user.avatarUrl && <AvatarImage src={item.user.avatarUrl} alt="" />}
          <AvatarFallback>{item.user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
      </Link>
      <div className="min-w-0 flex-1 space-y-1 text-sm">
        {body}
        <time dateTime={item.at.toISOString()} className="text-muted-foreground block text-xs">
          {timeFormatter.format(item.at)}
        </time>
      </div>
      {poster && (
        <span className="bg-muted relative aspect-[2/3] w-10 shrink-0 self-start overflow-hidden rounded-md">
          <Image src={poster} alt="" fill sizes="40px" className="object-cover" />
        </span>
      )}
    </article>
  );
}

function Extras({ rating, rewatch }: { rating: number | null; rewatch: boolean }) {
  return (
    <>
      {rating !== null && (
        <span className="ml-1.5 inline-flex items-center gap-0.5 font-bold text-amber-400">
          <Star className="size-3.5 fill-current" />
          {rating}/10
        </span>
      )}
      {rewatch && <Repeat aria-label="Tekrar izleme" className="text-muted-foreground ml-1.5 inline size-3.5" />}
    </>
  );
}
