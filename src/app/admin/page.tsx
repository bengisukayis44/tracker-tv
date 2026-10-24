import type { Metadata } from "next";
import Link from "next/link";
import { DayBars } from "@/components/admin/day-bars";
import { requireAdmin } from "@/lib/auth";
import { getAdminOverview } from "@/lib/admin";

export const metadata: Metadata = { title: "Genel bakış" };

function Stat({ label, value, detail, href }: { label: string; value: number; detail?: string; href?: string }) {
  const body = (
    <>
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="text-3xl font-extrabold tabular-nums">{value.toLocaleString("tr-TR")}</p>
      {detail && <p className="text-muted-foreground text-xs">{detail}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="bg-card hover:border-primary/50 space-y-1 rounded-2xl border p-4 transition-colors">
      {body}
    </Link>
  ) : (
    <div className="bg-card space-y-1 rounded-2xl border p-4">{body}</div>
  );
}

function Top({ title, rows }: { title: string; rows: { href: string; name: string; detail: string }[] }) {
  return (
    <section aria-labelledby={`top-${title}`} className="bg-card space-y-2 rounded-2xl border p-4">
      <h2 id={`top-${title}`} className="font-semibold">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">Bu hafta henüz izlenen yok.</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r, i) => (
            <li key={r.href} className="flex items-baseline gap-2 text-sm">
              <span className="text-muted-foreground w-4 tabular-nums">{i + 1}.</span>
              <Link href={r.href} className="hover:text-primary min-w-0 flex-1 truncate font-medium">
                {r.name}
              </Link>
              <span className="text-muted-foreground shrink-0">{r.detail}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Members, activity and what is being watched (test accounts left out). */
export default async function AdminOverviewPage() {
  await requireAdmin();
  const o = await getAdminOverview();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold tracking-tight">Genel bakış</h1>

      <section aria-label="Sayılar" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Üyeler"
          value={o.users}
          detail={`Son 7 günde +${o.newWeek} · 30 günde +${o.newMonth}`}
          href="/admin/kullanicilar"
        />
        <Stat label="Aktif (7 gün)" value={o.activeWeek} detail={`30 günde ${o.activeMonth} kişi izledi ya da yazdı`} />
        <Stat label="İzlenen bölüm" value={o.episodes} detail={`ve ${o.movies.toLocaleString("tr-TR")} film`} />
        <Stat
          label="Yorumlar"
          value={o.comments}
          detail={o.openReports ? `${o.openReports} yorum şikayet edildi` : "Bekleyen şikayet yok"}
          href="/admin/yorumlar"
        />
      </section>
      {o.suspended > 0 && <p className="text-muted-foreground text-sm">{o.suspended} hesap askıda.</p>}

      <div className="grid gap-3 lg:grid-cols-2">
        <DayBars title="Yeni üyeler · son 30 gün" unit="üye" data={o.signupsByDay} />
        <DayBars title="İzlemeler · son 30 gün" unit="izleme" data={o.watchesByDay} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Top
          title="Bu hafta en çok izlenen diziler"
          rows={o.topSeries.map((s) => ({
            href: `/series/${s.tmdbId}`,
            name: s.name,
            detail: `${s.people} kişi · ${s.episodes} bölüm`,
          }))}
        />
        <Top
          title="Bu hafta en çok izlenen filmler"
          rows={o.topMovies.map((m) => ({ href: `/movie/${m.tmdbId}`, name: m.name, detail: `${m.people} kişi` }))}
        />
      </div>
    </div>
  );
}
