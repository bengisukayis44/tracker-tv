import Image from "next/image";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { daysUntil, formatCountdown, formatDate } from "@/lib/format";
import type { UpcomingItem } from "@/lib/profile";
import { cn } from "@/lib/utils";

/** "Yakında": a coming episode or movie with how many days are left. */
export function UpcomingCard({ item }: { item: UpcomingItem }) {
  const days = daysUntil(item.airDate);
  return (
    <Link
      href={item.href}
      aria-label={`${item.name}: ${item.label}, ${formatCountdown(days)}`}
      className="bg-card hover:border-primary/40 flex items-center gap-3 rounded-2xl border p-3 transition-colors"
    >
      <span className="bg-muted relative aspect-[2/3] w-12 shrink-0 overflow-hidden rounded-md">
        {item.posterUrl && <Image src={item.posterUrl} alt="" fill sizes="48px" className="object-cover" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{item.name}</span>
        <span className="text-muted-foreground block truncate text-xs">{item.label}</span>
        <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
          <CalendarClock className="size-3" />
          {formatDate(item.airDate)}
        </span>
      </span>
      <span
        className={cn(
          "shrink-0 rounded-lg px-2.5 py-1 text-center text-sm font-bold whitespace-nowrap",
          days <= 1 ? "bg-emerald-500/15 text-emerald-400" : "bg-primary/10 text-primary",
        )}
      >
        {formatCountdown(days)}
      </span>
    </Link>
  );
}
