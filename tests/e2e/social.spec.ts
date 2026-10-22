import { Client } from "pg";
import { expect, resetAccount, test } from "./fixtures";
import { INCEPTION, SHERLOCK } from "./helpers";

async function withDb<T>(fn: (db: Client) => Promise<T>) {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

/** The other account watches Sherlock season 1 and Inception (rated 8) and comments, straight in the database. */
async function seedActivity(userId: string, comment: string) {
  await withDb(async (db) => {
    await db.query(
      `INSERT INTO "WatchedEpisode" ("id", "userId", "episodeId")
       SELECT gen_random_uuid()::text, $1, e."id"
       FROM "Episode" e JOIN "Season" s ON s."id" = e."seasonId" JOIN "Title" t ON t."id" = s."titleId"
       WHERE t."tmdbId" = $2 AND t."type" = 'SERIES' AND s."seasonNumber" = 1`,
      [userId, SHERLOCK.id],
    );
    await db.query(
      `INSERT INTO "WatchedMovie" ("id", "userId", "titleId", "rating")
       SELECT gen_random_uuid()::text, $1, "id", 8 FROM "Title" WHERE "tmdbId" = $2 AND "type" = 'MOVIE'`,
      [userId, INCEPTION.id],
    );
    await db.query(
      `INSERT INTO "Comment" ("id", "userId", "titleId", "content", "updatedAt")
       SELECT gen_random_uuid()::text, $1, "id", $3, now() FROM "Title" WHERE "tmdbId" = $2 AND "type" = 'MOVIE'`,
      [userId, INCEPTION.id, comment],
    );
  });
}

test.describe("Takip ve akış", () => {
  test("ziyaretçi akışa girmek için giriş yapar", async ({ page }) => {
    await page.goto("/akis");
    await expect(page).toHaveURL(`/login?callbackUrl=${encodeURIComponent("/akis")}`);
  });

  test("takip edilen kişinin izledikleri ve yorumu akışta görünür", async ({ signedInPage: page, otherAccount }) => {
    await resetAccount(otherAccount);
    const comment = `Akış yorumu ${Date.now()}`;
    try {
      await seedActivity(otherAccount.id, comment);

      await page.goto("/akis");
      await expect(page.getByText("Henüz kimseyi takip etmiyorsun")).toBeVisible();

      await page.goto(`/profile/${otherAccount.username}`);
      await expect(page.getByText(/0 takipçi/)).toBeVisible();
      await page.getByRole("button", { name: `@${otherAccount.username} takip et` }).click();
      await expect(page.getByText(`@${otherAccount.username} takip ediliyor.`)).toBeVisible();
      await expect(page.getByText(/1 takipçi/)).toBeVisible();

      await page.getByRole("navigation", { name: "Ana bölümler" }).getByRole("link", { name: "Akış" }).click();
      await expect(page).toHaveURL("/akis");
      const feed = page.getByRole("article");
      // Season 1 marked in one go is one line
      await expect(feed.filter({ hasText: `${SHERLOCK.name} dizisinden 3 bölüm izledi` })).toBeVisible();
      await expect(feed.filter({ hasText: `${INCEPTION.name} filmini izledi` })).toContainText("8/10");
      await expect(feed.filter({ hasText: comment })).toContainText("için yorum yazdı");

      // A private profile drops out of the feed and cannot be followed
      await withDb((db) => db.query(`UPDATE "User" SET "isPrivate" = true WHERE "id" = $1`, [otherAccount.id]));
      await page.reload();
      await expect(page.getByText("Akış şimdilik sessiz")).toBeVisible();
      await page.goto(`/profile/${otherAccount.username}`);
      await expect(page.getByText("Bu profil gizli")).toBeVisible();
      await expect(page.getByRole("button", { name: /takip/ })).toHaveCount(0);

      await withDb((db) => db.query(`UPDATE "User" SET "isPrivate" = false WHERE "id" = $1`, [otherAccount.id]));
      await page.reload();
      await page.getByRole("button", { name: `@${otherAccount.username} takipten çık` }).click();
      await expect(page.getByText(`@${otherAccount.username} takipten çıkarıldı.`)).toBeVisible();
      await page.goto("/akis");
      await expect(page.getByText("Henüz kimseyi takip etmiyorsun")).toBeVisible();
    } finally {
      await resetAccount(otherAccount);
    }
  });
});
