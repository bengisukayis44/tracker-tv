-- Second page of the profile cover: a character from a series or movie on the user's lists
ALTER TABLE "User" ADD COLUMN     "coverCharacterCastId" INTEGER,
ADD COLUMN     "coverCharacterTitleId" TEXT;
