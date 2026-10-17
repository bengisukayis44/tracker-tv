/**
 * OMDb API client (https://www.omdbapi.com) — IMDb ratings looked up by IMDb id.
 * Free keys allow 1,000 requests per day, so callers cache results (see catalog.ts).
 */

const BASE_URL = "https://www.omdbapi.com/";
const REQUEST_TIMEOUT_MS = 10_000;

export class OmdbError extends Error {
  constructor(
    message: string,
    public kind: "limit" | "auth" | "not_found" | "http" | "other",
  ) {
    super(message);
    this.name = "OmdbError";
  }
}

type OmdbResponse = { Response: "True" | "False"; Error?: string } & Record<string, unknown>;

type OmdbTitle = OmdbResponse & { imdbRating?: string; imdbID?: string; totalSeasons?: string };
type OmdbSeason = OmdbResponse & {
  Episodes?: { Episode: string; imdbRating: string; imdbID: string }[];
};

export function isOmdbEnabled() {
  return Boolean(process.env.OMDB_API_KEY);
}

/** "8.7" -> 8.7, "N/A" or junk -> null */
export function parseImdbRating(value: string | undefined | null): number | null {
  if (!value) return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n >= 0 && n <= 10 ? n : null;
}

function classifyError(message: string): OmdbError["kind"] {
  const m = message.toLowerCase();
  if (m.includes("limit")) return "limit";
  if (m.includes("api key")) return "auth";
  if (m.includes("not found") || m.includes("incorrect imdb id")) return "not_found";
  return "other";
}

async function omdbFetch<T extends OmdbResponse>(params: Record<string, string>): Promise<T> {
  const key = process.env.OMDB_API_KEY;
  if (!key) throw new OmdbError("OMDB_API_KEY tanımlı değil", "auth");

  const url = new URL(BASE_URL);
  for (const [k, v] of Object.entries({ ...params, apikey: key })) url.searchParams.set(k, v);

  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  // OMDb answers 401 for bad keys and for the daily limit; the JSON body says which
  const body = (await res.json().catch(() => null)) as T | null;
  if (body?.Response === "False") {
    const message = body.Error ?? "Bilinmeyen OMDb hatası";
    throw new OmdbError(`OMDb: ${message}`, classifyError(message));
  }
  if (!res.ok || !body) throw new OmdbError(`OMDb isteği başarısız: ${res.status}`, "http");
  return body;
}

export const omdb = {
  async getTitleRating(imdbId: string): Promise<number | null> {
    const data = await omdbFetch<OmdbTitle>({ i: imdbId });
    return parseImdbRating(data.imdbRating);
  },

  /** Ratings for every episode of one season, keyed by episode number. */
  async getSeasonRatings(
    imdbId: string,
    season: number,
  ): Promise<{ episode: number; imdbId: string; rating: number | null }[]> {
    try {
      const data = await omdbFetch<OmdbSeason>({ i: imdbId, Season: String(season) });
      return (data.Episodes ?? [])
        .map((ep) => ({ episode: Number(ep.Episode), imdbId: ep.imdbID, rating: parseImdbRating(ep.imdbRating) }))
        .filter((ep) => Number.isInteger(ep.episode));
    } catch (error) {
      // Seasons IMDb does not know about (e.g. brand new ones) just have no ratings
      if (error instanceof OmdbError && error.kind === "not_found") return [];
      throw error;
    }
  },
};
