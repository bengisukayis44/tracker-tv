/**
 * One-off: moves series stored from TVmaze over to TMDB, keeping episode rows and the watch history on them.
 * Run: npm run migrate:tmdb   (add -- --dry-run to only show the matches)
 */
import "dotenv/config";
import { moveSeriesToTmdb } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { tmdb } from "@/lib/tmdb";

const dryRun = process.argv.includes("--dry-run");

async function watchedCount() {
  return prisma.watchedEpisode.count();
}

async function main() {
  const titles = await prisma.title.findMany({
    where: { type: "SERIES", tmdbId: null },
    select: { id: true, name: true, imdbId: true, releaseDate: true, tvmazeId: true },
    orderBy: { name: "asc" },
  });
  console.log(`${titles.length} dizi taşınacak${dryRun ? " (deneme, hiçbir şey yazılmayacak)" : ""}.`);
  const before = await watchedCount();

  const unmatched: string[] = [];
  for (const title of titles) {
    try {
      if (dryRun) {
        const id = title.imdbId ? await tmdb.findTvByImdbId(title.imdbId) : null;
        console.log(`  ${title.name}: ${id ? `TMDB ${id}` : title.imdbId ? "IMDb ile bulunamadı" : "IMDb yok, ad+yıl ile aranacak"}`);
        continue;
      }
      const tmdbId = await moveSeriesToTmdb(title);
      if (tmdbId) console.log(`  ✓ ${title.name} → TMDB ${tmdbId}`);
      else {
        unmatched.push(title.name);
        console.log(`  ✗ ${title.name}: TMDB'de eşleşme bulunamadı`);
      }
    } catch (error) {
      unmatched.push(title.name);
      console.error(`  ✗ ${title.name}:`, error instanceof Error ? error.message : error);
    }
  }
  if (dryRun) return;

  const after = await watchedCount();
  const orphanWatches = await prisma.watchedEpisode.count({ where: { episode: { tmdbId: null } } });
  console.log(`\nİzleme kayıtları: önce ${before}, sonra ${after}${before === after ? " (hepsi korundu)" : " (!)"}`);
  console.log(`TMDB'de karşılığı olmayan bölüme bağlı izleme kaydı: ${orphanWatches}`);
  if (unmatched.length) console.log(`Taşınamayan diziler: ${unmatched.join(", ")}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
