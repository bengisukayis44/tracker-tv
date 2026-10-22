import { cleanText, tmdbImage } from "@/lib/tmdb";

/**
 * "Nerede izlenir": streaming, rental and purchase options in Turkey, from TMDB's watch providers
 * (data by JustWatch, which must be credited where it is shown).
 */
export const PROVIDER_REGION = "TR";

type TmdbProvider = { provider_id: number; provider_name: string; logo_path: string | null; display_priority: number };
export type TmdbRegionProviders = {
  link?: string;
  flatrate?: TmdbProvider[];
  free?: TmdbProvider[];
  ads?: TmdbProvider[];
  rent?: TmdbProvider[];
  buy?: TmdbProvider[];
};
/** `append_to_response=watch/providers` */
export type TmdbWatchProvidersResponse = { results: Record<string, TmdbRegionProviders | undefined> };

export type Provider = { id: number; name: string; logoUrl: string | null };
export type ProviderGroup = {
  kind: "flatrate" | "free" | "ads" | "rent" | "buy";
  label: string;
  providers: Provider[];
};
/** Stored in Title.watchProviders. No groups means it is not available on any platform in Turkey. */
export type WatchProviders = { link: string | null; groups: ProviderGroup[] };

const GROUPS: { kind: ProviderGroup["kind"]; label: string }[] = [
  { kind: "flatrate", label: "Abonelikle" },
  { kind: "free", label: "Ücretsiz" },
  { kind: "ads", label: "Reklamlı ücretsiz" },
  { kind: "rent", label: "Kirala" },
  { kind: "buy", label: "Satın al" },
];

/** Turkey's providers grouped by how they offer it, in JustWatch's order. */
export function providersFromTmdb(response: TmdbWatchProvidersResponse | undefined): WatchProviders {
  const region = response?.results[PROVIDER_REGION];
  if (!region) return { link: null, groups: [] };
  const groups = GROUPS.map(({ kind, label }) => ({
    kind,
    label,
    providers: [...(region[kind] ?? [])]
      .sort((a, b) => a.display_priority - b.display_priority)
      .map((p) => ({
        id: p.provider_id,
        name: cleanText(p.provider_name) ?? p.provider_name,
        logoUrl: tmdbImage(p.logo_path, "w92"),
      })),
  })).filter((g) => g.providers.length > 0);
  return { link: region.link ?? null, groups };
}

/** Title.watchProviders from the database, or null when it has not been fetched (or is malformed). */
export function parseProviders(value: unknown): WatchProviders | null {
  if (typeof value !== "object" || value === null || !Array.isArray((value as WatchProviders).groups)) return null;
  return value as WatchProviders;
}
