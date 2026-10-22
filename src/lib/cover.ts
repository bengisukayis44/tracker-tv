/** Profile cover rules that need no database, so they can be unit tested. */

/** /tv/{id}/images and /movie/{id}/images backdrops */
export type TmdbBackdrop = {
  file_path: string;
  iso_639_1: string | null;
  vote_average: number;
  width: number;
  height: number;
};

/** The picker shows this many first, then COVER_MORE more per "Daha fazla göster". */
export const COVER_FIRST = 10;
export const COVER_MORE = 20;

// TMDB image paths look like "/AbC123xyz.jpg"
const IMAGE_PATH = /^\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/;

export function isImagePath(path: unknown): path is string {
  return typeof path === "string" && IMAGE_PATH.test(path);
}

/**
 * Every image that can be a cover, best first: wide ones only, those without text first (closest to
 * real scenes), then the best rated.
 */
export function orderCoverImages(backdrops: TmdbBackdrop[]): string[] {
  const seen = new Set<string>();
  return backdrops
    .filter((b) => isImagePath(b.file_path) && b.width >= 1280 && b.width / b.height >= 1.5)
    .sort(
      (a, b) =>
        Number(Boolean(a.iso_639_1)) - Number(Boolean(b.iso_639_1)) ||
        b.vote_average - a.vote_average ||
        b.width - a.width,
    )
    .filter((b) => !seen.has(b.file_path) && seen.add(b.file_path))
    .map((b) => b.file_path);
}

/** "https://image.tmdb.org/t/p/w780/abc.jpg" → "/abc.jpg" (episode stills are stored as full URLs). */
export function imagePathOf(url: string | null | undefined): string | null {
  const path = url?.match(/^https:\/\/image\.tmdb\.org\/t\/p\/[a-z0-9]+(\/[^/]+)$/)?.[1];
  return isImagePath(path) ? path : null;
}

/**
 * Full image URL (backdrops and episode stills alike): w300 for the picker, the original for the profile
 * (the banner is up to ~1250 px wide, so sharp screens need more than w1280).
 */
export function coverImageUrl(path: string, size: "w300" | "w1280" | "original" = "original") {
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
