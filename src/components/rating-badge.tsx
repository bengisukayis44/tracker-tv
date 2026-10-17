import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Source rating (0-10). The label says where it comes from since it is not an IMDb rating yet. */
export function RatingBadge({
  value,
  source = "TVmaze",
  className,
}: {
  value: number | null | undefined;
  source?: string;
  className?: string;
}) {
  if (value == null) return null;
  return (
    <span
      title={`${source} kullanıcı puanı`}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-xs font-bold text-amber-400",
        className,
      )}
    >
      <Star className="size-3 fill-current" />
      {value.toFixed(1)}
      <span className="font-medium text-amber-400/70">{source}</span>
    </span>
  );
}
