import { withDb } from "./db";
import { expect, resetAccount, test } from "./fixtures";
import { INCEPTION, SHERLOCK } from "./helpers";

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

  test("takipçiler ve takip edilenler listelenir", async ({ signedInPage: page, account, otherAccount }) => {
    await resetAccount(otherAccount);
    try {
      await page.goto(`/profile/${otherAccount.username}`);
      await page.getByRole("button", { name: `@${otherAccount.username} takip et` }).click();
      await expect(page.getByText(`@${otherAccount.username} takip ediliyor.`)).toBeVisible();

      // The count opens the list
      await page.getByRole("link", { name: "1 takipçi" }).click();
      await expect(page).toHaveURL(`/profile/${otherAccount.username}/takipciler`);
      await expect(page.getByRole("heading", { level: 1, name: "Takipçiler" })).toBeVisible();
      const followers = page.getByRole("list", { name: "Takipçiler" });
      await expect(followers.getByRole("link", { name: new RegExp(`@${account.username}`) })).toBeVisible();
      // Nobody gets a button for themselves
      await expect(followers.getByRole("button")).toHaveCount(0);

      await page
        .getByRole("navigation", { name: "Takip listeleri" })
        .getByRole("link", { name: /Takip edilenler/ })
        .click();
      await expect(page).toHaveURL(`/profile/${otherAccount.username}/takip-edilenler`);
      await expect(page.getByText("Henüz kimse takip edilmiyor.")).toBeVisible();

      // My own list: unfollow straight from it
      await page.goto(`/profile/${account.username}`);
      await page.getByRole("link", { name: "1 takip" }).click();
      await expect(page).toHaveURL(`/profile/${account.username}/takip-edilenler`);
      const following = page.getByRole("list", { name: "Takip edilenler" });
      await following.getByRole("button", { name: `@${otherAccount.username} takipten çık` }).click();
      await expect(page.getByText(`@${otherAccount.username} takipten çıkarıldı.`)).toBeVisible();
      await page.reload();
      await expect(page.getByText("Henüz kimse takip edilmiyor.")).toBeVisible();

      // A private profile keeps its lists to itself
      await withDb((db) => db.query(`UPDATE "User" SET "isPrivate" = true WHERE "id" = $1`, [otherAccount.id]));
      await page.goto(`/profile/${otherAccount.username}/takipciler`);
      await expect(page.getByText("Bu profil gizli")).toBeVisible();

      await page.goto(`/profile/${otherAccount.username}/baska`);
      await expect(page.getByRole("heading", { name: "Sayfa bulunamadı" })).toBeVisible();
    } finally {
      await resetAccount(otherAccount);
    }
  });
});
