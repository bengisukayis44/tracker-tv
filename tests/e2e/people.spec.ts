import { withDb } from "./db";
import { expect, test } from "./fixtures";
import { expectNoHorizontalScroll, SHERLOCK } from "./helpers";

test.describe("Oyuncu sayfaları", () => {
  test("oyuncu listesinden oyuncu sayfasına gidilir; bilgiler ve yapımlar görünür", async ({ page }) => {
    await page.goto(`/series/${SHERLOCK.id}`);
    await page
      .getByRole("list", { name: "Oyuncu listesi" })
      .getByRole("link", { name: /Benedict Cumberbatch/ })
      .click();
    await expect(page).toHaveURL("/person/71580");
    await expect(page.getByRole("heading", { level: 1, name: "Benedict Cumberbatch" })).toBeVisible();
    await expect(page).toHaveTitle("Benedict Cumberbatch · Tracker.tv");
    await expect(page.getByText(/1976 doğumlu/)).toBeVisible();
    await expect(page.getByRole("link", { name: "IMDb'de görüntüle" })).toHaveAttribute(
      "href",
      "https://www.imdb.com/name/nm1212722/",
    );

    const series = page.getByRole("region", { name: /^Diziler/ });
    await expect(series.locator(`a[href="/series/${SHERLOCK.id}"]`)).toContainText("Sherlock Holmes");
    // Long roles get a season summary, short ones list their episodes
    await expect(series.getByText(/^Sezon 1–4.* · \d+ bölüm$/).first()).toBeVisible();
    const guest = series.getByRole("list", { name: "Oynadığı bölümler" }).first();
    await expect(guest.getByRole("link").first()).toHaveAttribute("href", /^\/series\/\d+\/season\/\d+\/episode\/\d+$/);
    await expect(guest.getByRole("link").first()).toContainText(/^S\d{2}E\d{2}/);
    const movies = page.getByRole("region", { name: /^Filmler/ });
    await expect(movies.getByRole("link").first()).toBeVisible();
    // Long lists open on demand
    const all = movies.getByRole("button", { name: /^Tümünü göster/ });
    const before = await movies.getByRole("link").count();
    await all.click();
    expect(await movies.getByRole("link").count()).toBeGreaterThan(before);
    await expectNoHorizontalScroll(page);
  });

  test("üyeye izlediği yapımlar işaretli görünür", async ({ signedInPage: page, account }) => {
    await withDb((db) =>
      db.query(
        `INSERT INTO "WatchedEpisode" ("id", "userId", "episodeId")
         SELECT gen_random_uuid()::text, $1, e."id"
         FROM "Episode" e JOIN "Season" s ON s."id" = e."seasonId" JOIN "Title" t ON t."id" = s."titleId"
         WHERE t."tmdbId" = $2 AND t."type" = 'SERIES' AND s."seasonNumber" = 1 AND e."episodeNumber" = 1`,
        [account.id, SHERLOCK.id],
      ),
    );
    await page.goto("/person/71580");
    await expect(page.getByText("1 tanesini izledin")).toBeVisible();
    await expect(page.locator(`a[href="/series/${SHERLOCK.id}"]`)).toContainText("İzledin");
  });

  test("bilinmeyen oyuncu için sayfa bulunamadı", async ({ page }) => {
    for (const url of ["/person/abc", "/person/999999999"]) {
      await page.goto(url);
      await expect(page.getByRole("heading", { name: "Sayfa bulunamadı" })).toBeVisible();
    }
  });
});
