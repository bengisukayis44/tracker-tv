-- Which part of the cover shows: 0 = top, 50 = middle, 100 = bottom
ALTER TABLE "User" ADD COLUMN     "coverPositionY" INTEGER NOT NULL DEFAULT 50;
