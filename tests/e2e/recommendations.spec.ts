import { withDb } from "./db";
import { expect, resetAccount, test } from "./fixtures";
import { SHERLOCK } from "./helpers";

/** Sherlock season 1 watched and rated 9, with Sherlock Holmes as the favourite character. */
const watchSherlock = (userId: string) =>
  withDb((db) =>
    db.query(
      `INSERT INTO "WatchedEpisode" ("id", "userId", "episodeId", "rating", "favoriteCastId", "favoriteCharacter")
       SELECT gen_random_uuid()::text, $1, e."id", 9, 71580, 'Sherlock Holmes'
       FROM "Episode" e JOIN "Season" s ON s."id" = e."seasonId" JOIN "Title" t ON t."id" = s."titleId"
       WHERE t."tmdbId" = $2 AND t."type" = 'SERIES' AND s."seasonNumber" = 1`,
      [userId, SHERLOCK.id],
    ),
  );

test.describe("Sana özel öneriler", () => {
  test("geçmişi olmayan kullanıcıya öneri satırı çıkmaz", async ({ signedInPage: page }) => {
    await page.goto("/");
    await expect(page.getByRole("region", { name: "Bu hafta popüler diziler" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Sana özel" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: /başka nerelerde oynadı/ })).toHaveCount(0);
  });

  test("izlenenlere, favori karaktere ve arkadaşlara göre dört satır; izlenenler önerilmez", async ({
    signedInPage: page,
    account,
    otherAccount,
  }) => {
    await resetAccount(otherAccount);
    try {
      await watchSherlock(account.id);
      // A followed friend watched Breaking Bad
      await withDb(async (db) => {
        await db.query(
          `INSERT INTO "WatchedEpisode" ("id", "userId", "episodeId")
           SELECT gen_random_uuid()::text, $1, e."id"
           FROM "Episode" e JOIN "Season" s ON s."id" = e."seasonId" JOIN "Title" t ON t."id" = s."titleId"
           WHERE t."tmdbId" = 1396 AND t."type" = 'SERIES' AND s."seasonNumber" = 1 AND e."episodeNumber" = 1`,
          [otherAccount.id],
        );
        await db.query(`INSERT INTO "Follow" ("followerId", "followingId") VALUES ($1, $2)`, [
          account.id,
          otherAccount.id,
        ]);
      });

      await page.goto("/");
      const sherlock = `a[href="/series/${SHERLOCK.id}"]`;

      const forYou = page.getByRole("region", { name: "Sana özel" });
      await expect(forYou.getByText(/sevdiğin için$/)).toBeVisible();
      await expect(forYou.getByRole("link").first()).toBeVisible();
      await expect(forYou.locator(sherlock)).toHaveCount(0);

      const because = page.getByRole("region", { name: `${SHERLOCK.name} izleyenler bunları da sevdi` });
      await expect(because.getByText("Yüksek puan verdiğin bir yapım")).toBeVisible();
      await expect(because.getByRole("link").first()).toBeVisible();
      await expect(because.locator(sherlock)).toHaveCount(0);

      const actor = page.getByRole("region", { name: "Benedict Cumberbatch başka nerelerde oynadı?" });
      await expect(actor.getByText("Favori karakterin Sherlock Holmes (Sherlock)")).toBeVisible();
      await expect(actor.getByRole("link").first()).toBeVisible();
      await expect(actor.locator(sherlock)).toHaveCount(0);

      const friends = page.getByRole("region", { name: "Arkadaşların izliyor" });
      await expect(friends.locator('a[href="/series/1396"]')).toContainText("1 arkadaşın izledi");
    } finally {
      await resetAccount(otherAccount);
    }
  });
});
