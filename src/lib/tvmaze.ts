/**
 * TVmaze API client (https://www.tvmaze.com/api) — free, no API key needed.
 * Stands in for TMDB until API keys are available; it has series only (no movies, no IMDb ratings).
 * Rate limit: ~20 requests / 10 s per IP, so 429 responses are retried with backoff.
 */

const BASE_URL = "https://api.tvmaze.com";
const MAX_RETRIES = 3;

type TvmazeImage = { medium: string; original: string } | null;

export type TvmazeShow = {
  id: number;
  name: string;
  type: string;
  language: string | null;
  genres: string[];
  status: string;
  runtime: number | null;
  averageRuntime: number | null;
  premiered: string | null;
  ended: string | null;
  rating: { average: number | null };
  network: { name: string } | null;
  webChannel: { name: string } | null;
  externals: { imdb: string | null; thetvdb: number | null; tvrage: number | null };
  image: TvmazeImage;
  summary: string | null;
};

export type TvmazeSeason = {
  id: number;
  number: number;
  name: string;
  image: TvmazeImage;
};

export type TvmazeEpisode = {
  id: number;
  name: string;
  season: number;
  number: number | null; // null for specials
  airstamp: string | null;
  runtime: number | null;
  rating: { average: number | null };
  image: TvmazeImage;
  summary: string | null;
};

export type TvmazeShowImage = {
  id: number;
  type: string | null; // poster | background | banner | typography
  main: boolean;
  resolutions: { original: { url: string; width?: number; height?: number } };
};

export type TvmazeShowWithEmbeds = TvmazeShow & {
  _embedded?: { episodes?: TvmazeEpisode[]; seasons?: TvmazeSeason[]; images?: TvmazeShowImage[] };
};

export class TvmazeError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "TvmazeError";
  }
}

const REQUEST_TIMEOUT_MS = 15_000;

function isRetryable(status: number, attempt: number) {
  // Rate limit: back off and retry; gateway errors are usually transient, so retry once
  return (status === 429 && attempt < MAX_RETRIES) || (status >= 502 && status <= 504 && attempt < 1);
}

async function tvmazeFetch<T>(path: string, attempt = 0): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (isRetryable(res.status, attempt)) {
    await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    return tvmazeFetch<T>(path, attempt + 1);
  }
  if (!res.ok) {
    throw new TvmazeError(`TVmaze isteği başarısız: ${res.status} ${path}`, res.status);
  }
  return res.json() as Promise<T>;
}

export const tvmaze = {
  async searchShows(query: string): Promise<TvmazeShow[]> {
    const q = query.trim();
    if (!q) return [];
    const results = await tvmazeFetch<{ score: number; show: TvmazeShow }[]>(
      `/search/shows?q=${encodeURIComponent(q)}`,
    );
    return results.map((r) => r.show);
  },

  /**
   * Show plus episodes, seasons and images. Fetched as separate requests in parallel because the
   * combined `?embed[]=…` request has proven unreliable (502s) while the single endpoints keep working.
   * Images are optional: if they fail the show is still returned without a backdrop.
   */
  async getShowWithEpisodes(id: number): Promise<TvmazeShowWithEmbeds> {
    const [show, episodes, seasons, images] = await Promise.all([
      tvmazeFetch<TvmazeShow>(`/shows/${id}`),
      tvmazeFetch<TvmazeEpisode[]>(`/shows/${id}/episodes`),
      tvmazeFetch<TvmazeSeason[]>(`/shows/${id}/seasons`),
      tvmazeFetch<TvmazeShowImage[]>(`/shows/${id}/images`).catch(() => []),
    ]);
    return { ...show, _embedded: { episodes, seasons, images } };
  },
};

/** Widest background image, preferring the one TVmaze marks as main. */
export function pickBackdrop(images: TvmazeShowImage[] | undefined): string | null {
  const backgrounds = (images ?? []).filter((img) => img.type === "background");
  backgrounds.sort(
    (a, b) =>
      Number(b.main) - Number(a.main) || (b.resolutions.original.width ?? 0) - (a.resolutions.original.width ?? 0),
  );
  return backgrounds[0]?.resolutions.original.url ?? null;
}

/** TVmaze summaries are HTML; we store plain text. */
export function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
  return text || null;
}
