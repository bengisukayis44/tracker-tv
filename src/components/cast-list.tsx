import Image from "next/image";
import { UserRound } from "lucide-react";
import type { CastMember } from "@/lib/cast";

/** "Oyuncular": actors with the characters they play, in a row that scrolls sideways on small screens. */
export function CastList({ cast }: { cast: CastMember[] }) {
  if (cast.length === 0) return null;
  return (
    <section aria-labelledby="cast-heading" className="space-y-4">
      <h2 id="cast-heading" className="text-xl font-bold">
        Oyuncular
      </h2>
      <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {cast.map((member) => (
          <li key={member.id} className="w-28 shrink-0 sm:w-32">
            <div className="bg-muted relative aspect-[2/3] overflow-hidden rounded-xl border">
              {member.profileUrl ? (
                <Image src={member.profileUrl} alt={member.name} fill sizes="128px" className="object-cover" />
              ) : (
                <div className="text-muted-foreground flex h-full items-center justify-center">
                  <UserRound className="size-10" />
                </div>
              )}
            </div>
            <p className="mt-2 text-sm leading-tight font-semibold">{member.name}</p>
            {member.character && (
              <p className="text-muted-foreground mt-0.5 text-xs leading-tight">{member.character}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
