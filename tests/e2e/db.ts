import { Client } from "pg";

/** Direct database access for test data, through the transaction pooler (the session pooler is left to the test server). */
export async function withDb<T>(fn: (db: Client) => Promise<T>) {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

/**
 * A made-up series straight in the database: episode 1 aired yesterday, episode 2 airs in `daysAhead` days.
 * Its negative TMDB id can never clash with a real one; it is up to date, so nothing asks TMDB for it.
 */
export async function createTestSeries(daysAhead: number) {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const titleId = `e2e-title-${suffix}`;
  const name = `E2E Dizi ${suffix}`;
  // Air dates are stored as midnight UTC of the (Turkish) calendar day
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
  // As text: pg would turn a Date into local time (+03:00) for this timestamp-without-time-zone column
  const day = (offset: number) =>
    new Date(Date.parse(`${today}T00:00:00Z`) + offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await withDb(async (db) => {
    await db.query(
      `INSERT INTO "Title" ("id", "tmdbId", "type", "name", "status", "lastSyncedAt", "castMembers")
       VALUES ($1, $2, 'SERIES', $3, 'Returning Series', now(), '[]')`,
      [titleId, -Math.floor(Math.random() * 1e9) - 1, name],
    );
    await db.query(`INSERT INTO "Season" ("id", "titleId", "seasonNumber") VALUES ($1, $2, 1)`, [
      `${titleId}-s1`,
      titleId,
    ]);
    await db.query(
      `INSERT INTO "Episode" ("id", "seasonId", "episodeNumber", "name", "airDate")
       VALUES ($1, $3, 1, 'İlk Bölüm', $4), ($2, $3, 2, 'Gelecek Bölüm', $5)`,
      [`${titleId}-e1`, `${titleId}-e2`, `${titleId}-s1`, day(-1), day(daysAhead)],
    );
  });
  return { titleId, name, remove: () => withDb((db) => db.query(`DELETE FROM "Title" WHERE "id" = $1`, [titleId])) };
}

export function addToWatchlist(userId: string, titleId: string) {
  return withDb((db) =>
    db.query(`INSERT INTO "WatchlistItem" ("userId", "titleId") VALUES ($1, $2)`, [userId, titleId]),
  );
}
