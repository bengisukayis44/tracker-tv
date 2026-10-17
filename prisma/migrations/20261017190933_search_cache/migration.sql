-- CreateTable
CREATE TABLE "SearchCache" (
    "query" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchCache_pkey" PRIMARY KEY ("query")
);

-- Supabase Data API exposes the public schema; keep it closed like every other table
ALTER TABLE "SearchCache" ENABLE ROW LEVEL SECURITY;
