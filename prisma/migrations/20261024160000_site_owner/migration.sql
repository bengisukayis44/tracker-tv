-- Site owner: grants and revokes admin rights
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isOwner" BOOLEAN NOT NULL DEFAULT false;


UPDATE "User" SET "isOwner" = true, "isAdmin" = true WHERE "email" = 'bengisukayis@gmail.com';
