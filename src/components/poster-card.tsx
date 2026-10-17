import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";

export function PosterCard({
  href,
  title,
  posterUrl,
  subtitle,
  rating,
  badge,
}: {
  href: string;
  title: string;
  posterUrl: string | null;
  subtitle?: string | null;
  rating?: number | null;
  badge?: string | null;
}) {
  return (
    <Link
      href={href}
      className="group bg-card focus-visible:ring-ring flex flex-col overflow-hidden rounded-xl border transition-all outline-none hover:-translate-y-0.5 hover:border-primary/40 focus-visible:ring-2"
    >
      <div className="bg-muted relative aspect-[2/3] overflow-hidden">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={title}
            fill
            sizes="(min-width: 1280px) 16vw, (min-width: 768px) 25vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-sm font-semibold">
            Poster yok
          </div>
        )}
        {rating != null && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-bold text-amber-400 backdrop-blur">
            <Star className="size-3 fill-current" />
            {rating.toFixed(1)}
          </span>
        )}
        {badge && (
          <span className="absolute top-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
            {badge}
          </span>
        )}
      </div>
      <div className="space-y-0.5 p-3">
        <h3 className="group-hover:text-primary line-clamp-2 text-sm leading-snug font-bold transition-colors">
          {title}
        </h3>
        {subtitle && <p className="text-muted-foreground line-clamp-1 text-xs">{subtitle}</p>}
      </div>
    </Link>
  );
}
