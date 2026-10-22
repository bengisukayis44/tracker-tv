-- Rewatches: the date of every extra watch
ALTER TABLE "WatchedEpisode" ADD COLUMN     "rewatchedAt" TIMESTAMP(3)[] DEFAULT ARRAY[]::TIMESTAMP(3)[];
ALTER TABLE "WatchedMovie" ADD COLUMN     "rewatchedAt" TIMESTAMP(3)[] DEFAULT ARRAY[]::TIMESTAMP(3)[];
