import Image from "next/image";
import Link from "next/link";
import { Calendar, Clock, Star } from "lucide-react";
import { episodeCode, formatDate, formatRuntime, type DisplayRating } from "@/lib/format";
import { cn } from "@/lib/utils";

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
  watched = false,
  action,
}: {
  href: string;
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  overview: string | null;
  stillUrl: string | null;
  airDate: Date | null;
  runtime: number | null;
  rating: DisplayRating | null;
  aired: boolean;
  watched?: boolean;
  /** Rendered next to the link, e.g. the watch toggle (a button cannot live inside the link). */
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "group bg-card hover:border-primary/40 flex items-center gap-2 rounded-xl border pr-3 transition-colors",
        watched && "border-emerald-500/30",
      )}
    >
      <Link
        href={href}
        className="focus-visible:ring-ring flex min-w-0 flex-1 gap-4 rounded-xl p-3 outline-none focus-visible:ring-2"
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
            {rating && (
              <span
                title={`${rating.source} puanı`}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-amber-400"
              >
                <Star className="size-3 fill-current" />
                {rating.value.toFixed(1)}
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
            {watched && <span className="font-semibold text-emerald-400">İzlendi</span>}
            {!aired && (
              <span className="rounded border border-orange-400/30 bg-orange-400/10 px-1.5 py-0.5 font-semibold text-orange-400">
                Yayınlanmadı
              </span>
            )}
          </div>
        </div>
      </Link>
      {action}
    </div>
  );
}
