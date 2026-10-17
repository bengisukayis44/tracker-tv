import Image from "next/image";
import Link from "next/link";
import { Calendar, Clock, Star } from "lucide-react";
import { episodeCode, formatDate, formatRuntime } from "@/lib/format";

export function EpisodeRow({
  href,
  seasonNumber,
  episodeNumber,
  name,
  overview,
  stillUrl,
  airDate,
  runtime,
  rating,
  aired,
}: {
  href: string;
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  overview: string | null;
  stillUrl: string | null;
  airDate: Date | null;
  runtime: number | null;
  rating: number | null;
  aired: boolean;
}) {
  return (
    <Link
      href={href}
      className="group bg-card focus-visible:ring-ring flex gap-4 rounded-xl border p-3 transition-colors outline-none hover:border-primary/40 focus-visible:ring-2"
    >
      <div className="bg-muted relative aspect-video w-28 shrink-0 self-start overflow-hidden rounded-lg sm:w-40">
        {stillUrl ? (
          <Image src={stillUrl} alt="" fill sizes="160px" className="object-cover" />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center text-[10px] font-semibold">
            Görsel yok
          </div>
        )}
        <span className="absolute right-1 bottom-1 rounded bg-black/80 px-1 py-0.5 text-[10px] font-bold tracking-wide text-white">
          {episodeCode(seasonNumber, episodeNumber)}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="group-hover:text-primary line-clamp-1 text-sm font-bold transition-colors">
            {episodeNumber}. {name}
          </h3>
          {rating != null && (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-amber-400">
              <Star className="size-3 fill-current" />
              {rating.toFixed(1)}
            </span>
          )}
        </div>
        {overview && <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">{overview}</p>}
        <div className="text-muted-foreground mt-auto flex flex-wrap items-center gap-3 text-[11px]">
          <span className="inline-flex items-center gap-1">
            <Calendar className="size-3" />
            {formatDate(airDate) ?? "Tarih belli değil"}
          </span>
          {formatRuntime(runtime) && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {formatRuntime(runtime)}
            </span>
          )}
          {!aired && (
            <span className="rounded border border-orange-400/30 bg-orange-400/10 px-1.5 py-0.5 font-semibold text-orange-400">
              Yayınlanmadı
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
