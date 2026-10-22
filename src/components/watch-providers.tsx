import Image from "next/image";
import { ExternalLink, MonitorPlay } from "lucide-react";
import type { WatchProviders as Providers } from "@/lib/providers";

/** "Nerede izlenir": platforms in Turkey. JustWatch must be credited wherever this data is shown (TMDB terms). */
export function WatchProviders({ providers }: { providers: Providers | null }) {
  // Not fetched yet: the background refresh fills it for the next visit
  if (!providers) return null;

  return (
    <section aria-labelledby="providers-heading" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="providers-heading" className="inline-flex items-center gap-2 text-xl font-bold">
          <MonitorPlay className="size-5" />
          Nerede izlenir
        </h2>
        {providers.link && (
          <a
            href={providers.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm font-medium"
          >
            Tüm seçenekler
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>

      {providers.groups.length === 0 ? (
        <p className="text-muted-foreground text-sm">Şu an Türkiye&apos;de bir dijital platformda bulunmuyor.</p>
      ) : (
        <div className="flex flex-wrap gap-x-8 gap-y-4">
          {providers.groups.map((group) => (
            <div key={group.kind} className="space-y-2">
              <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{group.label}</h3>
              <ul aria-label={group.label} className="flex flex-wrap gap-2">
                {group.providers.map((p) => (
                  <li key={p.id} title={p.name} className="flex items-center gap-2 rounded-lg border px-2 py-1.5">
                    {p.logoUrl && <Image src={p.logoUrl} alt="" width={24} height={24} className="size-6 rounded-md" />}
                    <span className="text-sm font-semibold">{p.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <p className="text-muted-foreground text-xs">Türkiye için platform bilgileri JustWatch tarafından sağlanır.</p>
    </section>
  );
}
