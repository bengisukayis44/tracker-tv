-- Cast with character names, fetched from TMDB with the title
ALTER TABLE "Title" ADD COLUMN "castMembers" JSONB;

-- "Favori karakter" on a watched episode or movie
ALTER TABLE "WatchedEpisode" ADD COLUMN "favoriteCastId" INTEGER, ADD COLUMN "favoriteCharacter" TEXT;
ALTER TABLE "WatchedMovie" ADD COLUMN "favoriteCastId" INTEGER, ADD COLUMN "favoriteCharacter" TEXT;
