import type { TmdbAggregateCast, TmdbMovieCast } from "@/lib/cast";
import type { TmdbWatchProvidersResponse } from "@/lib/providers";

/**
 * TMDB API client (https://developer.themoviedb.org) — series (and later movies) data, in Turkish where available.
 * Auth: API Read Access Token (v4) as a Bearer token in TMDB_API_KEY.
 * Episodes with no Turkish translation fall back to English names and overviews.
 */

const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";
const LANGUAGE = "tr-TR";
const FALLBACK_LANGUAGE = "en-US";
// TMDB allows up to 20 items in append_to_response, so seasons are fetched 20 at a time
const SEASONS_PER_REQUEST = 20;
const MAX_RATE_LIMIT_RETRIES = 3;

export type TmdbRequestOptions = { timeoutMs?: number; retries?: number };
const DEFAULT_OPTIONS: Required<TmdbRequestOptions> = { timeoutMs: 15_000, retries: 2 };

export type TmdbTvSearchItem = {
  id: number;
  adult?: boolean;
  name: string;
  overview: string;
  poster_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
};

export type TmdbEpisode = {
  id: number;
  season_number: number;
  episode_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  runtime: number | null;
  still_path: string | null;
  vote_average: number;
  vote_count: number;
};

export type TmdbSeason = {
  season_number: number;
  name: string;
  poster_path: string | null;
  episodes: TmdbEpisode[];
};

export type TmdbTvDetails = {
  id: number;
  name: string;
  overview: string;
  status: string; // Returning Series | Ended | Canceled | In Production | Planned | Pilot
  first_air_date: string | null;
  vote_average: number;
  vote_count: number;
  genres: { id: number; name: string }[];
  episode_run_time: number[];
  poster_path: string | null;
  backdrop_path: string | null;
  seasons: { season_number: number; name: string; poster_path: string | null; episode_count: number }[];
  external_ids?: { imdb_id: string | null; tvdb_id: number | null };
  translations?: { translations: { iso_639_1: string; data: { overview?: string; name?: string } }[] };
  aggregate_credits?: { cast: TmdbAggregateCast[] };
  "watch/providers"?: TmdbWatchProvidersResponse;
};

export type TmdbMovieSearchItem = {
  id: number;
  adult?: boolean;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
};

/** /search/multi result: series and movies (people are filtered out). */
export type TmdbMultiSearchItem =
  | (TmdbTvSearchItem & { media_type: "tv" })
  | (TmdbMovieSearchItem & { media_type: "movie" })
  | { media_type: "person"; id: number };

export type TmdbMovieDetails = {
  id: number;
  title: string;
  overview: string;
  status: string; // Released | Post Production | In Production | Planned | Rumored | Canceled
  release_date: string | null;
  runtime: number | null;
  vote_average: number;
  vote_count: number;
  genres: { id: number; name: string }[];
  poster_path: string | null;
  backdrop_path: string | null;
  imdb_id: string | null;
  translations?: { translations: { iso_639_1: string; data: { overview?: string; title?: string } }[] };
  credits?: { cast: TmdbMovieCast[] };
  "watch/providers"?: TmdbWatchProvidersResponse;
};

/** A series with every season's episodes, Turkish with English fallbacks already applied. */
export type TmdbTvWithSeasons = TmdbTvDetails & { seasonsWithEpisodes: TmdbSeason[] };

export class TmdbError extends Error {
  constructor(
    message: string,
    public status?: number,
    /** The request was cancelled because it took longer than the allowed time */
    public timedOut = false,
  ) {
    super(message);
    this.name = "TmdbError";
  }
}

const backoff = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function tmdbFetch<T>(
  path: string,
  params: Record<string, string> = {},
  options: TmdbRequestOptions = {},
  attempt = 0,
): Promise<T> {
  const token = process.env.TMDB_API_KEY;
  if (!token) throw new TmdbError("TMDB_API_KEY tanımlı değil. .env.example dosyasına bakın.");
  const { timeoutMs, retries } = { ...DEFAULT_OPTIONS, ...options };

  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let res: Response;
  try {
    res = await fetch(url, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (attempt < retries) {
      await backoff(500 * 2 ** attempt);
      return tmdbFetch<T>(path, params, options, attempt + 1);
    }
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new TmdbError(
      `TMDB'ye ulaşılamadı: ${path} (${error instanceof Error ? error.message : error})`,
      undefined,
      timedOut,
    );
  }

  if (res.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
    const retryAfter = Number(res.headers.get("Retry-After")) || 1;
    await backoff(retryAfter * 1000);
    return tmdbFetch<T>(path, params, options, attempt + 1);
  }
  if (res.status >= 500 && attempt < retries) {
    await backoff(500 * 2 ** attempt);
    return tmdbFetch<T>(path, params, options, attempt + 1);
  }
  if (!res.ok) throw new TmdbError(`TMDB isteği başarısız: ${res.status} ${path}`, res.status);
  return res.json() as Promise<T>;
}

// ---------- Pure helpers (unit tested) ----------

// Bidirectional control marks (e.g. U+200E) that some TMDB translations wrap around names
const INVISIBLE_MARKS = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

/** Trimmed text without invisible direction marks; null when nothing is left. */
export function cleanText(value: string | null | undefined): string | null {
  const text = value?.replace(INVISIBLE_MARKS, "").trim();
  return text ? text : null;
}

/** TMDB fills untranslated episode names with placeholders like "3. Bölüm" or "Episode 3". */
export function isPlaceholderEpisodeName(name: string | null | undefined): boolean {
  return !name || /^(\d+\.\s*bölüm|bölüm\s*\d+|episode\s*\d+)$/i.test(name.trim());
}

/** Turkish episode with English name/overview where Turkish is missing. */
export function mergeEpisodeTranslation(tr: TmdbEpisode, en: TmdbEpisode | undefined): TmdbEpisode {
  if (!en) return tr;
  const name = isPlaceholderEpisodeName(tr.name) && !isPlaceholderEpisodeName(en.name) ? en.name : tr.name;
  return { ...tr, name, overview: tr.overview?.trim() ? tr.overview : en.overview };
}

/** 0-10 rating, or null when nobody has voted yet. */
export function tmdbRating(voteAverage: number | null | undefined, voteCount: number | null | undefined) {
  return voteCount && voteAverage ? Math.round(voteAverage * 10) / 10 : null;
}

export function tmdbImage(
  path: string | null | undefined,
  size: "w92" | "w185" | "w342" | "w500" | "w780" | "w1280" | "original",
) {
  return path ? `${IMAGE_BASE_URL}/${size}${path}` : null;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ---------- API ----------

let tvGenresCache: Promise<Map<number, string>> | null = null;
let movieGenresCache: Promise<Map<number, string>> | null = null;

function loadGenres(kind: "tv" | "movie", options?: TmdbRequestOptions) {
  return tmdbFetch<{ genres: { id: number; name: string }[] }>(
    `/genre/${kind}/list`,
    { language: LANGUAGE },
    options,
  ).then((data) => new Map(data.genres.map((g) => [g.id, g.name])));
}

export const tmdb = {
  async searchTv(query: string, options?: TmdbRequestOptions): Promise<TmdbTvSearchItem[]> {
    const q = query.trim();
    if (!q) return [];
    const data = await tmdbFetch<{ results: TmdbTvSearchItem[] }>(
      "/search/tv",
      { query: q, language: LANGUAGE, include_adult: "false", page: "1" },
      options,
    );
    return data.results;
  },

  async searchMovies(query: string, options?: TmdbRequestOptions): Promise<TmdbMovieSearchItem[]> {
    const q = query.trim();
    if (!q) return [];
    const data = await tmdbFetch<{ results: TmdbMovieSearchItem[] }>(
      "/search/movie",
      { query: q, language: LANGUAGE, include_adult: "false", page: "1" },
      options,
    );
    return data.results;
  },

  /** Series and movies in one list, in TMDB's relevance order (people are left out). */
  async searchMulti(
    query: string,
    options?: TmdbRequestOptions,
  ): Promise<Exclude<TmdbMultiSearchItem, { media_type: "person" }>[]> {
    const q = query.trim();
    if (!q) return [];
    const data = await tmdbFetch<{ results: TmdbMultiSearchItem[] }>(
      "/search/multi",
      { query: q, language: LANGUAGE, include_adult: "false", page: "1" },
      options,
    );
    return data.results.filter(
      (r): r is Exclude<TmdbMultiSearchItem, { media_type: "person" }> =>
        r.media_type === "tv" || r.media_type === "movie",
    );
  },

  /** This week's most popular series or movies worldwide (adult titles left out). */
  async trending<K extends "tv" | "movie">(
    kind: K,
    options?: TmdbRequestOptions,
  ): Promise<(K extends "tv" ? TmdbTvSearchItem : TmdbMovieSearchItem)[]> {
    const data = await tmdbFetch<{ results: (K extends "tv" ? TmdbTvSearchItem : TmdbMovieSearchItem)[] }>(
      `/trending/${kind}/week`,
      { language: LANGUAGE },
      options,
    );
    return data.results.filter((r) => !r.adult);
  },

  /** Movies in Turkish cinemas now. */
  async nowPlaying(options?: TmdbRequestOptions): Promise<TmdbMovieSearchItem[]> {
    const data = await tmdbFetch<{ results: TmdbMovieSearchItem[] }>(
      "/movie/now_playing",
      { language: LANGUAGE, region: "TR", page: "1" },
      options,
    );
    return data.results.filter((r) => !r.adult);
  },

  /** Genre id → Turkish name, fetched once per server instance. */
  tvGenres(options?: TmdbRequestOptions): Promise<Map<number, string>> {
    tvGenresCache ??= loadGenres("tv", options).catch((error) => {
      tvGenresCache = null; // try again next time
      throw error;
    });
    return tvGenresCache;
  },

  movieGenres(options?: TmdbRequestOptions): Promise<Map<number, string>> {
    movieGenresCache ??= loadGenres("movie", options).catch((error) => {
      movieGenresCache = null;
      throw error;
    });
    return movieGenresCache;
  },

  /** Movie details and cast in Turkish; the overview falls back to English when there is no translation. */
  async getMovie(id: number, options?: TmdbRequestOptions): Promise<TmdbMovieDetails> {
    const movie = await tmdbFetch<TmdbMovieDetails>(
      `/movie/${id}`,
      { language: LANGUAGE, append_to_response: "translations,credits,watch/providers" },
      options,
    );
    const englishOverview = movie.translations?.translations.find((t) => t.iso_639_1 === "en")?.data.overview;
    return { ...movie, overview: movie.overview?.trim() ? movie.overview : (englishOverview ?? "") };
  },

  /** Finds a TMDB series id by IMDb id (used to move series over from the old data source). */
  async findTvByImdbId(imdbId: string, options?: TmdbRequestOptions): Promise<number | null> {
    const data = await tmdbFetch<{ tv_results: { id: number }[] }>(
      `/find/${encodeURIComponent(imdbId)}`,
      { external_source: "imdb_id" },
      options,
    );
    return data.tv_results[0]?.id ?? null;
  },

  /** Series details, cast and all seasons' episodes (Turkish, English fallback), in as few requests as possible. */
  async getTvWithSeasons(id: number, options?: TmdbRequestOptions): Promise<TmdbTvWithSeasons> {
    const details = await tmdbFetch<TmdbTvDetails>(
      `/tv/${id}`,
      { language: LANGUAGE, append_to_response: "external_ids,translations,aggregate_credits,watch/providers" },
      options,
    );

    const seasonNumbers = details.seasons.map((s) => s.season_number);
    const fetchSeasons = async (language: string) => {
      const batches = await Promise.all(
        chunk(seasonNumbers, SEASONS_PER_REQUEST).map((batch) =>
          tmdbFetch<Record<string, TmdbSeason | undefined>>(
            `/tv/${id}`,
            { language, append_to_response: batch.map((n) => `season/${n}`).join(",") },
            options,
          ),
        ),
      );
      const byNumber = new Map<number, TmdbSeason>();
      for (const data of batches) {
        for (const n of seasonNumbers) {
          const season = data[`season/${n}`];
          if (season) byNumber.set(n, season);
        }
      }
      return byNumber;
    };

    const [turkish, english] = await Promise.all([fetchSeasons(LANGUAGE), fetchSeasons(FALLBACK_LANGUAGE)]);

    const seasonsWithEpisodes = seasonNumbers
      .map((n) => {
        const tr = turkish.get(n);
        if (!tr) return null;
        const enEpisodes = new Map((english.get(n)?.episodes ?? []).map((ep) => [ep.episode_number, ep]));
        return {
          ...tr,
          episodes: tr.episodes.map((ep) => mergeEpisodeTranslation(ep, enEpisodes.get(ep.episode_number))),
        };
      })
      .filter((s): s is TmdbSeason => s !== null);

    // Series overview: Turkish if translated, otherwise English
    const englishOverview = details.translations?.translations.find((t) => t.iso_639_1 === "en")?.data.overview;
    return {
      ...details,
      overview: details.overview?.trim() ? details.overview : (englishOverview ?? ""),
      seasonsWithEpisodes,
    };
  },
};
