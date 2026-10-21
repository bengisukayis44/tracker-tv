-- AlterTable
ALTER TABLE "Episode" ADD COLUMN     "tmdbId" INTEGER;

-- Search results switch from TVmaze to TMDB ids; the old cached shape is dropped
DELETE FROM "SearchCache";
