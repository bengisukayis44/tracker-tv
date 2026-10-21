import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { RatingBadge } from "@/components/rating-badge";
import { Badge } from "@/components/ui/badge";
import { genreLabel, type DisplayRating } from "@/lib/format";

/** Poster, backdrop, title, facts, rating, genres and overview — shared by series and movie pages. */
export function TitleHero({
  name,
  posterUrl,
  backdropUrl,
  facts,
  rating,
  genres,
  overview,
  imdbId,
  children,
}: {
  name: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  /** Short facts under the title (year, status, length…); empty entries are skipped */
  facts: React.ReactNode[];
  rating: DisplayRating | null;
  genres: string[];
  overview: string | null;
  imdbId: string | null;
  /** Actions and progress below the overview */
  children?: React.ReactNode;
}) {
  return (
    <section className="bg-card relative -mx-4 overflow-hidden border-y sm:mx-0 sm:rounded-3xl sm:border">
      {backdropUrl && (
        <>
          <Image src={backdropUrl} alt="" fill priority sizes="100vw" className="object-cover opacity-30" />
          <div className="from-card via-card/85 to-card/40 absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r" />
        </>
      )}
      <div className="relative flex flex-col gap-6 p-5 sm:p-8 md:flex-row md:gap-8">
        <div className="bg-muted relative aspect-[2/3] w-36 shrink-0 overflow-hidden rounded-xl border shadow-2xl sm:w-48 md:w-56">
          {posterUrl ? (
            <Image src={posterUrl} alt={name} fill priority sizes="224px" className="object-cover" />
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center text-sm font-semibold">
              Poster yok
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl">{name}</h1>
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {facts.filter(Boolean).map((fact, i) => (
                <span key={i}>{fact}</span>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <RatingBadge rating={rating} />
            {genres.map((g) => (
              <Badge key={g} variant="secondary">
                {genreLabel(g)}
              </Badge>
            ))}
          </div>

          {overview && <p className="text-foreground/85 max-w-3xl leading-relaxed">{overview}</p>}

          {imdbId && (
            <a
              href={`https://www.imdb.com/title/${imdbId}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm font-medium"
            >
              IMDb&apos;de görüntüle
              <ExternalLink className="size-3.5" />
            </a>
          )}

          {children}
        </div>
      </div>
    </section>
  );
}
