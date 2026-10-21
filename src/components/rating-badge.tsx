import { Star } from "lucide-react";
import type { DisplayRating } from "@/lib/format";
import { cn } from "@/lib/utils";

/** 0-10 rating labelled with where it comes from (IMDb, or TMDB when IMDb has none). */
export function RatingBadge({ rating, className }: { rating: DisplayRating | null; className?: string }) {
  if (!rating) return null;
  return (
    <span
      title={`${rating.source} puanı`}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-xs font-bold text-amber-400",
        className,
      )}
    >
      <Star className="size-3 fill-current" />
      {rating.value.toFixed(1)}
      <span className="font-medium text-amber-400/70">{rating.source}</span>
    </span>
  );
}
