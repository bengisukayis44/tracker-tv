const dateFormatter = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" });

export function formatDate(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  return dateFormatter.format(new Date(date));
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

const STATUS_LABELS: Record<string, string> = {
  Running: "Devam ediyor",
  Ended: "Final yaptı",
  "To Be Determined": "Belirsiz",
  "In Development": "Yapım aşamasında",
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

/** Genres are stored as a JSON column; guard against unexpected shapes. */
export function parseGenres(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((g): g is string => typeof g === "string") : [];
}
