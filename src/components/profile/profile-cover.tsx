"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { CoverBanner } from "./cover-banner";
import { CoverCharacterPicker } from "./cover-character-picker";
import { CoverPicker } from "./cover-picker";

export type CoverCharacterView = {
  character: string;
  actorName: string;
  /** TMDB person id, for the actor's page */
  personId: number;
  photoUrl: string | null;
  titleName: string;
  /** "dizisinden" or "filminden" */
  from: string;
  href: string;
  backdropUrl: string | null;
};

/**
 * The profile cover: up to two pages side by side, the chosen scene and the chosen character
 * ("Sherlock Holmes · Sherlock dizisinden"). Swipe on phones; arrows, dots or the keyboard elsewhere.
 */
export function ProfileCover({
  scene,
  character,
  isMe,
}: {
  scene: { src: string; positionY: number } | null;
  character: CoverCharacterView | null;
  isMe: boolean;
}) {
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const pages = Number(Boolean(scene)) + Number(Boolean(character));

  const goTo = (index: number, behavior: ScrollBehavior = "smooth") => {
    const box = scroller.current;
    if (box) box.scrollTo({ left: index * box.clientWidth, behavior });
  };

  // After a change, show the page that changed (the browser would otherwise keep whichever page was in view)
  const sceneSrc = scene?.src;
  const characterName = character?.character;
  const shown = useRef({ sceneSrc, characterName });
  useEffect(() => {
    const before = shown.current;
    shown.current = { sceneSrc, characterName };
    const box = scroller.current;
    if (!box) return;
    if (sceneSrc && sceneSrc !== before.sceneSrc) box.scrollTo({ left: 0, behavior: "instant" });
    else if (characterName && characterName !== before.characterName) {
      box.scrollTo({ left: (sceneSrc ? 1 : 0) * box.clientWidth, behavior: "instant" });
    }
  }, [sceneSrc, characterName]);

  const startEditing = (on: boolean) => {
    // The scene is the first page; it must be the one on screen while its position is set
    if (on) scroller.current?.scrollTo({ left: 0 });
    setEditing(on);
  };

  return (
    <div
      className={cn(
        "bg-muted relative -mx-4 aspect-[2/1] overflow-hidden sm:mx-0 sm:aspect-[3/1] sm:rounded-3xl",
        // Above the name row that overlaps the cover's bottom edge, so nothing covers the controls
        editing && "z-10",
      )}
    >
      <div
        ref={scroller}
        tabIndex={pages > 1 ? 0 : undefined}
        aria-label={pages > 1 ? "Profil kapağı, 2 sayfa; yana kaydır" : undefined}
        onScroll={(e) => setPage(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className={cn(
          "flex h-full snap-x snap-mandatory outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          editing ? "overflow-hidden" : "overflow-x-auto",
        )}
      >
        {scene && (
          <CoverBanner
            src={scene.src}
            positionY={scene.positionY}
            editable={isMe}
            editing={editing}
            onEditingChange={startEditing}
          >
            <CoverPicker hasCover />
            {!character && <CoverCharacterPicker hasCharacter={false} />}
          </CoverBanner>
        )}
        {character && (
          <CharacterSlide character={character}>
            {isMe && (
              <div className="absolute top-3 right-3 flex flex-wrap justify-end gap-2">
                <CoverCharacterPicker hasCharacter />
                {!scene && <CoverPicker hasCover={false} />}
              </div>
            )}
          </CharacterSlide>
        )}
      </div>

      {pages > 1 && !editing && (
        <>
          <div className="absolute top-3 left-3 flex gap-1.5 rounded-full bg-black/40 px-2 py-1.5">
            {[0, 1].map((i) => (
              <button
                key={i}
                type="button"
                aria-label={`${i + 1}. sayfa`}
                aria-current={page === i}
                onClick={() => goTo(i)}
                className={cn("size-2 rounded-full transition-colors", page === i ? "bg-white" : "bg-white/40")}
              />
            ))}
          </div>
          {page > 0 && <ArrowButton side="left" onClick={() => goTo(page - 1)} />}
          {page < pages - 1 && <ArrowButton side="right" onClick={() => goTo(page + 1)} />}
        </>
      )}
    </div>
  );
}

function ArrowButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Önceki sayfa" : "Sonraki sayfa"}
      className={cn(
        "absolute top-1/2 hidden -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70 sm:block",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}

/** The character page: the actor's photo as a big round icon over a blurred image of the series or movie. */
function CharacterSlide({ character, children }: { character: CoverCharacterView; children?: React.ReactNode }) {
  return (
    <div className="relative h-full w-full shrink-0 snap-center overflow-hidden">
      {character.backdropUrl && (
        <Image
          src={character.backdropUrl}
          alt=""
          fill
          unoptimized
          className="scale-110 object-cover opacity-70 blur-lg"
        />
      )}
      <div className="from-background/90 via-background/40 absolute inset-0 bg-gradient-to-r to-transparent" />
      {/* Bottom padding: the name row overlaps the cover's lower edge */}
      <div className="relative flex h-full items-center gap-4 px-6 pb-10 sm:gap-8 sm:px-14 sm:pb-12">
        <div className="bg-muted ring-primary/70 relative size-24 shrink-0 overflow-hidden rounded-full ring-4 sm:size-40">
          {character.photoUrl ? (
            <Image
              src={character.photoUrl}
              alt={character.actorName}
              fill
              unoptimized
              className="object-cover object-top"
            />
          ) : (
            <UserRound className="text-muted-foreground absolute inset-0 m-auto size-12" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-primary text-xs font-bold tracking-wider uppercase">Favori karakter</p>
          <p className="truncate text-2xl leading-tight font-extrabold sm:text-4xl">{character.character}</p>
          <p className="text-foreground/80 mt-1 truncate text-sm sm:text-base">
            <Link href={character.href} className="hover:text-primary font-semibold">
              {character.titleName}
            </Link>{" "}
            {character.from} ·{" "}
            <Link href={`/person/${character.personId}`} className="hover:text-primary">
              {character.actorName}
            </Link>
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}
