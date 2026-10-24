"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Genel bakış" },
  { href: "/admin/kullanicilar", label: "Kullanıcılar" },
  { href: "/admin/yorumlar", label: "Yorumlar" },
] as const;

export function AdminNav({ openReports }: { openReports: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Yönetim bölümleri" className="flex gap-1 overflow-x-auto border-b pb-px">
      {LINKS.map((l) => {
        const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold",
              active
                ? "border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {l.label}
            {l.href === "/admin/yorumlar" && openReports > 0 && (
              <span
                aria-label={`${openReports} şikayetli yorum`}
                className="bg-destructive text-white rounded-full px-1.5 text-xs leading-5"
              >
                {openReports}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
