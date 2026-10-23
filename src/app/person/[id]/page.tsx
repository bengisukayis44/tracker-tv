import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, ExternalLink, UserRound } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PosterCard } from "@/components/poster-card";
import { ExpandableGrid, ShowMoreText } from "@/components/show-more";
import { getCurrentUser } from "@/lib/auth";
import { titleHref } from "@/lib/catalog";
import type { Appearance } from "@/lib/appearance";
import { episodeCode, formatDate } from "@/lib/format";
import { getPerson, watchedAmong, type PersonPage } from "@/lib/person";
import { TmdbError } from "@/lib/tmdb";

type Props = { params: Promise<{ id: string }> };

// How many cards each section shows before "Tümünü göster"
const FIRST = 12;

async function load(idParam: string): Promise<PersonPage | "unavailable"> {
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();
  try {
    return await getPerson(id);
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) notFound();
    console.error("Oyuncu yüklenemedi:", error);
    return "unavailable";
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const person = await load((await params).id);
  return { title: person === "unavailable" ? "Oyuncu" : person.name };
}

/** Age in whole years on `until` (or today). */
function age(birthday: string, until?: string | null) {
  const born = new Date(birthday);
  const end = until ? new Date(until) : new Date();
  let years = end.getUTCFullYear() - born.getUTCFullYear();
  if (
    end.getUTCMonth() < born.getUTCMonth() ||
    (end.getUTCMonth() === born.getUTCMonth() && end.getUTCDate() < born.getUTCDate())
  )
    years--;
  return years;
}

export default async function PersonPageView({ params }: Props) {
  const [person, user] = await Promise.all([load((await params).id), getCurrentUser()]);
  if (person === "unavailable") {
    return (
      <EmptyState
        icon={<AlertCircle />}
        title="Oyuncu bilgisi şu an yüklenemedi"
        text="Veri kaynağı yanıt vermiyor. Biraz sonra tekrar dene."
      />
    );
  }

  const watched = user ? await watchedAmong(user.id, person.credits) : new Set<string>();
  const series = person.credits.filter((c) => c.type === "SERIES");
  const movies = person.credits.filter((c) => c.type === "MOVIE");
  const facts = [
    person.birthday &&
      `${formatDate(person.birthday)} doğumlu${person.deathday ? "" : ` (${age(person.birthday)} yaşında)`}`,
    person.deathday &&
      person.birthday &&
      `${formatDate(person.deathday)} tarihinde ${age(person.birthday, person.deathday)} yaşında öldü`,
    person.placeOfBirth,
  ].filter(Boolean);

  const section = (title: string, list: PersonPage["credits"]) =>
    list.length > 0 && (
      <section aria-labelledby={`credits-${title}`} className="space-y-4">
        <h2 id={`credits-${title}`} className="text-xl font-bold">
          {title} <span className="text-muted-foreground font-normal">{list.length}</span>
        </h2>
        <ExpandableGrid
          first={FIRST}
          total={list.length}
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
        >
          {list.map((c) => (
            <div key={`${c.type}-${c.tmdbId}`} className="space-y-1.5">
              <PosterCard
                href={titleHref(c.type, c.tmdbId)}
                title={c.name}
                posterUrl={c.posterUrl}
                badge={watched.has(`${c.type}-${c.tmdbId}`) ? "İzledin" : null}
                subtitle={[c.characters.join(" / "), c.year].filter(Boolean).join(" · ")}
              />
              {c.appearance && <AppearanceLines tmdbId={c.tmdbId} appearance={c.appearance} />}
            </div>
          ))}
        </ExpandableGrid>
      </section>
    );

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="bg-muted relative aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-2xl border sm:w-52">
          {person.photoUrl ? (
            <Image src={person.photoUrl} alt={person.name} fill priority unoptimized className="object-cover" />
          ) : (
            <UserRound className="text-muted-foreground absolute inset-0 m-auto size-16" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{person.name}</h1>
            {facts.map((f) => (
              <p key={f as string} className="text-muted-foreground text-sm">
                {f}
              </p>
            ))}
          </div>
          <p className="text-sm">
            <span className="font-semibold">{series.length}</span> dizi ·{" "}
            <span className="font-semibold">{movies.length}</span> film
            {user && (
              <>
                {" "}
                · <span className="font-semibold text-emerald-400">{watched.size}</span> tanesini izledin
              </>
            )}
          </p>
          {person.biography && <ShowMoreText text={person.biography} />}
          {person.imdbId && (
            <a
              href={`https://www.imdb.com/name/${person.imdbId}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium"
            >
              IMDb&apos;de görüntüle
              <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      </header>

      {section("Diziler", series)}
      {section("Filmler", movies)}
    </div>
  );
}

/** Under a series card: the guest episodes (each linked) or the seasons the actor is in. */
function AppearanceLines({ tmdbId, appearance }: { tmdbId: number; appearance: Appearance }) {
  if (appearance.kind !== "episodes") {
    return appearance.text ? <p className="text-muted-foreground px-1 text-xs">{appearance.text}</p> : null;
  }
  return (
    <ul aria-label="Oynadığı bölümler" className="space-y-0.5 px-1">
      {appearance.episodes.map((e) => (
        <li key={`${e.season}-${e.episode}`} className="truncate text-xs">
          <Link
            href={`/series/${tmdbId}/season/${e.season}/episode/${e.episode}`}
            // Many of these on one page; no need to load each episode in advance
            prefetch={false}
            className="text-muted-foreground hover:text-primary"
          >
            <span className="text-foreground font-semibold">{episodeCode(e.season, e.episode)}</span>
            {e.name && ` · ${e.name}`}
          </Link>
        </li>
      ))}
    </ul>
  );
}
