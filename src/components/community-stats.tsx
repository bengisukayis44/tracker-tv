import { Star, Users } from "lucide-react";
import { CastAvatar } from "@/components/watch/character-picker";
import type { CastMember } from "@/lib/cast";
import type { CommunityStats as Stats } from "@/lib/community";
import Link from "next/link";

/** "Topluluk": how everyone who watched it rated it, felt about it and which character they loved most. */
export function CommunityStats({ stats, cast }: { stats: Stats; cast: CastMember[] }) {
  return (
    <section aria-labelledby="community-heading" className="bg-card space-y-5 rounded-2xl border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="community-heading" className="inline-flex items-center gap-2 text-lg font-bold">
          <Users className="size-5" />
          Topluluk
        </h2>
        <p className="text-muted-foreground text-sm">
          {stats.watchers === 0 ? "Henüz kimse izlemedi" : `${stats.watchers} kişi izledi`}
        </p>
      </div>

      {stats.watchers > 0 && (
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-1">
            <h3 className="text-muted-foreground text-sm font-semibold">Ortalama puan</h3>
            {stats.averageRating !== null ? (
              <p className="inline-flex items-baseline gap-1.5">
                <Star className="size-5 fill-amber-400 text-amber-400" />
                <span className="text-3xl font-extrabold">{stats.averageRating.toLocaleString("tr-TR")}</span>
                <span className="text-muted-foreground text-sm">/10 · {stats.ratingCount} puan</span>
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">Henüz puan verilmedi</p>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-muted-foreground text-sm font-semibold">Nasıl hissettirdi?</h3>
            {stats.emotions.length === 0 ? (
              <p className="text-muted-foreground text-sm">Henüz duygu seçilmedi</p>
            ) : (
              <ul aria-label="Topluluğun duyguları" className="space-y-1.5">
                {stats.emotions.map((e) => (
                  <li key={e.value} className="space-y-0.5">
                    <div className="flex justify-between text-sm">
                      <span>
                        <span aria-hidden>{e.emoji}</span> {e.label}
                      </span>
                      <span className="text-muted-foreground">%{e.percent}</span>
                    </div>
                    <div className="bg-secondary h-1.5 overflow-hidden rounded-full">
                      <div className="bg-primary h-full rounded-full" style={{ width: `${e.percent}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-muted-foreground text-sm font-semibold">En sevilen karakterler</h3>
            {stats.characters.length === 0 ? (
              <p className="text-muted-foreground text-sm">Henüz karakter seçilmedi</p>
            ) : (
              <ol aria-label="En sevilen karakterler" className="space-y-2">
                {stats.characters.map((c) => {
                  const member = cast.find((m) => m.id === c.castId);
                  return (
                    <li key={c.castId} className="flex items-center gap-2.5">
                      <CastAvatar member={member} className="size-8" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{c.character}</span>
                        {member && (
                          <Link
                            href={`/person/${member.id}`}
                            className="text-muted-foreground hover:text-primary block truncate text-xs"
                          >
                            {member.name}
                          </Link>
                        )}
                      </span>
                      <span className="text-muted-foreground text-sm">%{c.percent}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
