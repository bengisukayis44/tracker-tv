-- Profile cover: a TMDB scene image of something the user watched (only the image path is stored)
ALTER TABLE "User" ADD COLUMN     "coverPath" TEXT;
