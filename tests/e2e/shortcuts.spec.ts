import { withDb } from "./db";
import { expect, test } from "./fixtures";
import { SHERLOCK } from "./helpers";

const episodeUrl = (e: number) => `/series/${SHERLOCK.id}/season/1/episode/${e}`;

/** Sherlock season 1 watched straight in the database, with a favourite character per episode. */
async function watchWithFavorites(userId: string, picks: { episode: number; castId: number; character: string }[]) {
  await withDb(async (db) => {
    for (const p of picks) {
      await db.query(
        `INSERT INTO "WatchedEpisode" ("id", "userId", "episodeId", "favoriteCastId", "favoriteCharacter")
         SELECT gen_random_uuid()::text, $1, e."id", $3, $4
         FROM "Episode" e JOIN "Season" s ON s."id" = e."seasonId" JOIN "Title" t ON t."id" = s."titleId"
         WHERE t."tmdbId" = $5 AND t."type" = 'SERIES' AND s."seasonNumber" = 1 AND e."episodeNumber" = $2`,
        [userId, p.episode, p.castId, p.character, SHERLOCK.id],
      );
    }
  });
}

test.describe("Kısayollar", () => {
  test("bölüm sayfasından sonraki bölüm izlendi olarak işaretlenir", async ({ signedInPage: page }) => {
    await page.goto(episodeUrl(1));
    const next = page.getByRole("region", { name: "Sonraki bölüm" });
    await expect(next).toContainText("Sonraki bölüm · S01E02");
    await next.getByRole("button", { name: "Sonraki bölümü izledim" }).click();

    // This episode is still unwatched, so the usual question comes
    const prompt = page.getByRole("dialog", { name: "Önceki 1 bölümü de izledin mi?" });
    await prompt.getByRole("button", { name: "Hayır, sadece bu bölüm" }).click();
    await expect(next.getByText("İzlendi")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Bu bölümü izledin mi?" })).toBeVisible();

    // The toast leads to the next episode, already marked
    await page.getByRole("button", { name: "Bölüme git" }).click();
    await expect(page).toHaveURL(episodeUrl(2));
    await expect(page.getByRole("heading", { name: "İzledin" })).toBeVisible();
  });

  test("ziyaretçi kısayola basınca giriş sayfasına gider", async ({ page }) => {
    await page.goto(episodeUrl(1));
    await page.getByRole("button", { name: "Sonraki bölümü izledim" }).click();
    await expect(page).toHaveURL(`/login?callbackUrl=${encodeURIComponent(episodeUrl(1))}`);
  });
});

test.describe("En sevdiğin karakterler", () => {
  test("seçilen favori karakterler profilde sayılarıyla sıralanır", async ({ signedInPage: page, account }) => {
    await page.goto(`/profile/${account.username}`);
    const section = page.getByRole("region", { name: "En sevdiğin karakterler" });
    await expect(section).toContainText("Favori karakterin");

    await watchWithFavorites(account.id, [
      { episode: 1, castId: 7060, character: "John Watson" },
      { episode: 2, castId: 71580, character: "Sherlock Holmes" },
      { episode: 3, castId: 71580, character: "Sherlock Holmes" },
    ]);
    await page.reload();
    const cards = section.getByRole("listitem");
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText("Sherlock Holmes");
    await expect(cards.nth(0)).toContainText("Benedict Cumberbatch");
    await expect(cards.nth(0)).toContainText(`${SHERLOCK.name} · 2 kez`);
    await expect(cards.nth(1)).toContainText("John Watson");
    await expect(cards.nth(1)).toContainText("1 kez");

    // Others see it too, in the third person; without picks it is not shown to them at all
    const visitor = await page.context().browser()!.newPage({ baseURL: test.info().project.use.baseURL });
    try {
      await visitor.goto(`/profile/${account.username}`);
      await expect(visitor.getByRole("region", { name: "En sevdiği karakterler" }).getByRole("listitem")).toHaveCount(
        2,
      );
      await withDb((db) => db.query(`DELETE FROM "WatchedEpisode" WHERE "userId" = $1`, [account.id]));
      await visitor.reload();
      await expect(visitor.getByRole("region", { name: /karakterler/ })).toHaveCount(0);
    } finally {
      await visitor.close();
    }
  });
});
