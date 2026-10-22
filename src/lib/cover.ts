/** Profile cover rules that need no database, so they can be unit tested. */

/** /tv/{id}/images and /movie/{id}/images backdrops */
export type TmdbBackdrop = {
  file_path: string;
  iso_639_1: string | null;
  vote_average: number;
  width: number;
  height: number;
};

/** How many images the picker offers per series or movie. */
export const COVER_CHOICES = 10;

// TMDB image paths look like "/AbC123xyz.jpg"
const IMAGE_PATH = /^\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/;

export function isImagePath(path: unknown): path is string {
  return typeof path === "string" && IMAGE_PATH.test(path);
}

/**
 * The images to offer: wide ones only, those without text first (closest to real scenes),
 * then the best rated, at most COVER_CHOICES.
 */
export function pickCoverImages(backdrops: TmdbBackdrop[]): string[] {
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
    .slice(0, COVER_CHOICES)
    .map((b) => b.file_path);
}

/** Full image URL: w300 for the picker, w1280 for the profile. */
export function coverImageUrl(path: string, size: "w300" | "w1280" = "w1280") {
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
