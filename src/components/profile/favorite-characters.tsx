import Image from "next/image";
import Link from "next/link";
import { Heart, UserRound } from "lucide-react";
import type { FavoriteCharacter } from "@/lib/profile";
import { ScrollRow } from "@/components/scroll-row";

/** "En sevdiğin karakterler": favourite-character picks summed up, most picked first. */
export function FavoriteCharacters({ characters, isMe }: { characters: FavoriteCharacter[]; isMe: boolean }) {
  // Nothing to show to others; the owner gets a hint on how it fills up
  if (characters.length === 0 && !isMe) return null;
  const title = isMe ? "En sevdiğin karakterler" : "En sevdiği karakterler";

  return (
    <section aria-labelledby="favorite-characters-heading" className="space-y-3">
      <h2 id="favorite-characters-heading" className="inline-flex items-center gap-2 text-lg font-bold">
        <Heart className="size-5 text-rose-400" />
        {title}
      </h2>
      {characters.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Bölüm ya da film izlerken İzledim penceresinde &ldquo;Favori karakterin&rdquo;i seçtikçe burada toplanır.
        </p>
      ) : (
        <ScrollRow as="ol" label={title} focusable className="-mx-4 gap-3 rounded-lg px-4 pb-2 sm:mx-0 sm:px-0">
          {characters.map((c, i) => (
            <li key={c.key} className="bg-card w-36 shrink-0 overflow-hidden rounded-xl border sm:w-40">
              <div className="bg-muted relative aspect-square">
                {c.photoUrl ? (
                  <Image
                    src={c.photoUrl}
                    alt={c.actorName ?? ""}
                    fill
                    sizes="160px"
                    className="object-cover object-top"
                  />
                ) : (
                  <div className="text-muted-foreground flex h-full items-center justify-center">
                    <UserRound className="size-10" />
                  </div>
                )}
                <span className="absolute top-2 left-2 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-bold text-white">
                  {i + 1}
                </span>
              </div>
              <div className="space-y-0.5 p-2.5">
                <p className="truncate text-sm font-bold">{c.character}</p>
                {c.actorName && (
                  <p className="text-muted-foreground truncate text-xs">
                    <Link href={`/person/${c.castId}`} className="hover:text-primary">
                      {c.actorName}
                    </Link>
                  </p>
                )}
                <p className="text-muted-foreground truncate text-xs">
                  <Link href={c.title.href} className="hover:text-primary font-semibold">
                    {c.title.name}
                  </Link>{" "}
                  · {c.picks} kez
                </p>
              </div>
            </li>
          ))}
        </ScrollRow>
      )}
    </section>
  );
}
