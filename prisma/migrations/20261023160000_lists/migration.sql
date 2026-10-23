-- User-named lists of series and movies
-- CreateTable
CREATE TABLE "List" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "List_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "ListItem" (
    "listId" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ListItem_pkey" PRIMARY KEY ("listId","titleId")
);
-- CreateIndex
CREATE INDEX "List_userId_idx" ON "List"("userId");
-- CreateIndex
CREATE INDEX "ListItem_titleId_idx" ON "ListItem"("titleId");
-- AddForeignKey
ALTER TABLE "List" ADD CONSTRAINT "List_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "List" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ListItem" ENABLE ROW LEVEL SECURITY;
