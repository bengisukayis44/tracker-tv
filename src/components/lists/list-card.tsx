import Image from "next/image";
import Link from "next/link";
import { ListVideo, Lock } from "lucide-react";
import type { ListSummary } from "@/lib/lists";

/** A list on the profile: a 2×2 poster collage, its name and how many titles it has. */
export function ListCard({ list }: { list: ListSummary }) {
  return (
    <Link
      href={`/list/${list.id}`}
      className="group bg-card hover:border-primary/40 flex flex-col overflow-hidden rounded-xl border transition-colors"
    >
      <div className="bg-muted grid aspect-square grid-cols-2 grid-rows-2 gap-px">
        {[0, 1, 2, 3].map((i) =>
          list.posters[i] ? (
            <span key={i} className="relative">
              <Image src={list.posters[i]!} alt="" fill sizes="120px" className="object-cover" />
            </span>
          ) : (
            <span key={i} className="bg-card/60 flex items-center justify-center">
              {i === 0 && list.posters.length === 0 && <ListVideo className="text-muted-foreground size-8" />}
            </span>
          ),
        )}
      </div>
      <div className="space-y-0.5 p-3">
        <h3 className="group-hover:text-primary flex items-center gap-1.5 text-sm font-bold">
          <span className="truncate">{list.name}</span>
          {!list.isPublic && <Lock aria-label="Gizli liste" className="text-muted-foreground size-3.5 shrink-0" />}
        </h3>
        <p className="text-muted-foreground text-xs">{list.count} yapım</p>
      </div>
    </Link>
  );
}
