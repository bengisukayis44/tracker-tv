// Turkish time everywhere, so server and browser print the same day
const TIME_ZONE = "Europe/Istanbul";
const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: TIME_ZONE,
});
const shortDateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: TIME_ZONE,
});

/** "25 Temmuz 2010" */
export function formatDate(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  return dateFormatter.format(new Date(date));
}

/** "25 Tem 2010" */
export function formatShortDate(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  return shortDateFormatter.format(new Date(date));
}

export function formatRuntime(minutes: number | null | undefined): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} dk`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} sa ${rest} dk` : `${hours} sa`;
}

/** S01E05 */
export function episodeCode(season: number, episode: number): string {
  return `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
}

// TMDB series statuses
const STATUS_LABELS: Record<string, string> = {
  "Returning Series": "Devam ediyor",
  Ended: "Final yaptı",
  Canceled: "İptal edildi",
  "In Production": "Yapım aşamasında",
  Planned: "Planlanıyor",
  Pilot: "Pilot",
  // TMDB movie statuses
  Released: "Vizyonda",
  "Post Production": "Post prodüksiyon",
  Rumored: "Söylenti",
};

export function statusLabel(status: string | null | undefined): string | null {
  if (!status) return null;
  return STATUS_LABELS[status] ?? status;
}

const GENRE_LABELS: Record<string, string> = {
  Action: "Aksiyon",
  Adult: "Yetişkin",
  Adventure: "Macera",
  Anime: "Anime",
  Children: "Çocuk",
  Comedy: "Komedi",
  Crime: "Suç",
  DIY: "Kendin yap",
  Drama: "Dram",
  Espionage: "Casusluk",
  Family: "Aile",
  Fantasy: "Fantastik",
  Food: "Yemek",
  History: "Tarih",
  Horror: "Korku",
  Legal: "Hukuk",
  Medical: "Tıp",
  Music: "Müzik",
  Mystery: "Gizem",
  Nature: "Doğa",
  Romance: "Romantik",
  "Science-Fiction": "Bilim kurgu",
  Sports: "Spor",
  Supernatural: "Doğaüstü",
  Thriller: "Gerilim",
  Travel: "Seyahat",
  War: "Savaş",
  Western: "Western",
};

export function genreLabel(genre: string): string {
  return GENRE_LABELS[genre] ?? genre;
}

export type DisplayRating = { value: number; source: "IMDb" | "TMDB" };

/** IMDb rating when known, otherwise the TMDB user rating, always labelled with its source. */
export function pickRating(imdbRating: number | null | undefined, sourceRating: number | null | undefined) {
  if (imdbRating != null) return { value: imdbRating, source: "IMDb" } satisfies DisplayRating;
  if (sourceRating != null) return { value: sourceRating, source: "TMDB" } satisfies DisplayRating;
  return null;
}

/**
 * Total watch time (PROJE_PLANI.md §4.7): "3 ay 2 gün 4 saat" with 1 ay = 30 gün, 1 gün = 24 saat.
 * Zero units are left out; under an hour it is shown in minutes, nothing at all as "0 saat".
 */
export function formatWatchTime(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  if (minutes === 0) return "0 saat";
  if (minutes < 60) return `${minutes} dakika`;
  const totalHours = Math.floor(minutes / 60);
  const months = Math.floor(totalHours / (30 * 24));
  const days = Math.floor((totalHours % (30 * 24)) / 24);
  const hours = totalHours % 24;
  return [months && `${months} ay`, days && `${days} gün`, hours && `${hours} saat`].filter(Boolean).join(" ");
}

const isoDay = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }); // YYYY-MM-DD

/** Whole calendar days (Turkish time) from `now` until `date`: 0 today, 1 tomorrow, negative in the past. */
export function daysUntil(date: Date, now = new Date()): number {
  const day = (d: Date) => Date.parse(`${isoDay.format(d)}T00:00:00Z`);
  return Math.round((day(date) - day(now)) / (24 * 60 * 60 * 1000));
}

/** "Bugün", "Yarın", "3 gün sonra" */
export function formatCountdown(days: number): string {
  if (days <= 0) return "Bugün";
  if (days === 1) return "Yarın";
  return `${days} gün sonra`;
}
