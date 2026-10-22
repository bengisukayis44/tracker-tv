"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, ListVideo, Rss, Search, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Main sections as tabs: Keşfet, Akış, İzleme listem, Ara, Profilim.
 * Signed-out visitors see them too; the personal ones lead to the login page and back.
 */
export function SiteNav({ username, className }: { username: string | null; className?: string }) {
  const pathname = usePathname();
  const needsLogin = (path: string) => (username ? path : `/login?callbackUrl=${encodeURIComponent(path)}`);
  const profilePath = username ? `/profile/${username}` : "/profile";

  const tabs = [
    { label: "Keşfet", href: "/", icon: Compass, active: pathname === "/" },
    { label: "Akış", href: needsLogin("/akis"), icon: Rss, active: pathname.startsWith("/akis") },
    {
      label: "İzleme listem",
      href: needsLogin("/watchlist"),
      icon: ListVideo,
      active: pathname.startsWith("/watchlist"),
    },
    { label: "Ara", href: "/search", icon: Search, active: pathname.startsWith("/search") },
    {
      label: "Profilim",
      href: username ? profilePath : "/login",
      icon: UserRound,
      active: username !== null && pathname === profilePath,
    },
  ];

  return (
    <nav aria-label="Ana bölümler" className={className}>
      <ul className="flex h-full items-stretch">
        {tabs.map(({ label, href, icon: Icon, active }) => (
          <li key={label} className="flex flex-1 lg:flex-none">
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 border-b-2 px-3 text-xs font-semibold transition-colors sm:flex-row sm:gap-2 sm:text-sm lg:px-4",
                active
                  ? "border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              <Icon className="size-4" />
              <span className="whitespace-nowrap">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
