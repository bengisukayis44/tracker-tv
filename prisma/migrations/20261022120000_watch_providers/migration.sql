-- Where to watch in Turkey (TMDB / JustWatch), fetched with the title
ALTER TABLE "Title" ADD COLUMN "watchProviders" JSONB;
