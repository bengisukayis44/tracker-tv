import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, INCEPTION, SHERLOCK } from "./helpers";

test.describe("Arama", () => {
  test("ana sayfadan arama yapılır ve sonuçtan diziye gidilir", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("textbox", { name: "Dizi ya da film ara" }).fill("sherlock");
    await page.getByRole("textbox", { name: "Dizi ya da film ara" }).press("Enter");

    await expect(page).toHaveURL(/\/search\?q=sherlock/);
    await expect(page.getByText(/“sherlock” için \d+ sonuç/)).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.locator(`a[href="/series/${SHERLOCK.id}"]`).first().click();
    await expect(page.getByRole("heading", { level: 1, name: SHERLOCK.name })).toBeVisible();
  });

  test("hepsi aramasında diziler ve filmler birlikte gelir", async ({ page }) => {
    await page.goto("/search?q=sherlock");
    await expect(page.locator(`a[href="/series/${SHERLOCK.id}"]`).first()).toBeVisible();
    await expect(page.locator(`a[href^="/movie/"]`).first()).toBeVisible();
  });

  test("film filtresi yalnızca filmleri getirir ve film sayfasına gider", async ({ page }) => {
    await page.goto("/search?q=inception");
    await page.getByRole("link", { name: "Film", exact: true }).click();
    await expect(page).toHaveURL(/tur=film/);
    await expect(page.locator(`a[href^="/series/"]`)).toHaveCount(0);

    await page.locator(`a[href="/movie/${INCEPTION.id}"]`).first().click();
    await expect(page).toHaveURL(`/movie/${INCEPTION.id}`);
    await expect(page.getByRole("heading", { level: 1, name: INCEPTION.name })).toBeVisible();
    await expect(page).toHaveTitle(`${INCEPTION.name} (2010) · Tracker.tv`);
    await expect(page.getByText("2 sa 28 dk")).toBeVisible();
    await expect(page.getByRole("link", { name: "IMDb'de görüntüle" })).toHaveAttribute(
      "href",
      `https://www.imdb.com/title/${INCEPTION.imdbId}/`,
    );
    await expect(page.getByRole("heading", { name: "Bu filmi izledin mi?" })).toBeVisible();
    const cast = page.getByRole("region", { name: "Oyuncular" });
    await expect(cast.getByText("Leonardo DiCaprio")).toBeVisible();
    await expect(cast.getByText("Dom Cobb", { exact: true })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("sonuçsuz ve boş arama açıklayıcı mesaj gösterir", async ({ page }) => {
    // A slow data source is also an acceptable answer here
    await page.goto("/search?q=xqzjvkwqpl");
    await expect(page.getByText("Sonuç bulunamadı").or(page.getByText("Veri kaynağı şu an yavaş"))).toBeVisible();

    await page.goto("/search");
    await expect(page.getByText("Aramaya başla")).toBeVisible();
  });
});

test.describe("Dizi ve bölüm sayfaları", () => {
  test("dizi sayfası bilgileri, puanı ve sezonları gösterir", async ({ page }) => {
    await page.goto(`/series/${SHERLOCK.id}`);
    await expect(page.getByRole("heading", { level: 1, name: SHERLOCK.name })).toBeVisible();
    await expect(page).toHaveTitle(`${SHERLOCK.name} · Tracker.tv`);
    // Specials have their own tab but are not counted
    await expect(page.getByText("4 sezon · 12 bölüm")).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Sezon seçimi" }).getByRole("link", { name: "Özel bölümler" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "The Movie Database (TMDB)" })).toBeVisible();
    await expect(page.getByTitle(/(IMDb|TVmaze) puanı/).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "IMDb'de görüntüle" })).toHaveAttribute(
      "href",
      "https://www.imdb.com/title/tt1475582/",
    );
    const cast = page.getByRole("region", { name: "Oyuncular" });
    await expect(cast.getByText("Benedict Cumberbatch")).toBeVisible();
    await expect(cast.getByText("Sherlock Holmes", { exact: true })).toBeVisible();
    await expectNoHorizontalScroll(page);

    // Season tabs
    const tabs = page.getByRole("navigation", { name: "Sezon seçimi" });
    await expect(tabs.getByRole("link", { name: "Sezon 1" })).toHaveAttribute("aria-current", "page");
    await tabs.getByRole("link", { name: "Sezon 3" }).click();
    await expect(page).toHaveURL(`/series/${SHERLOCK.id}/season/3`);
    await expect(page).toHaveTitle(`${SHERLOCK.name} · Sezon 3 · Tracker.tv`);
    await expect(tabs.getByRole("link", { name: "Sezon 3" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("S03E01")).toBeVisible();
  });

  test("bölüm sayfası ve sezonlar arası önceki/sonraki gezinme", async ({ page }) => {
    await page.goto(`/series/${SHERLOCK.id}/season/2`);
    await page.getByRole("link", { name: /Belgravia'da Bir Skandal/ }).click();

    await expect(page).toHaveURL(`/series/${SHERLOCK.id}/season/2/episode/1`);
    await expect(page.getByRole("heading", { level: 1, name: "Belgravia'da Bir Skandal" })).toBeVisible();
    await expect(page.getByText("S02E01", { exact: true })).toBeVisible();
    await expectNoHorizontalScroll(page);

    const nav = page.getByRole("navigation", { name: "Bölüm gezinmesi" });
    await nav.getByRole("link", { name: /Önceki bölüm/ }).click();
    await expect(page).toHaveURL(`/series/${SHERLOCK.id}/season/1/episode/3`);

    await page
      .getByRole("navigation", { name: "Bölüm gezinmesi" })
      .getByRole("link", { name: /Sonraki bölüm/ })
      .click();
    await expect(page).toHaveURL(`/series/${SHERLOCK.id}/season/2/episode/1`);

    // Breadcrumb back to the season
    await page.getByRole("navigation", { name: "Konum" }).getByRole("link", { name: "Sezon 2" }).click();
    await expect(page).toHaveURL(`/series/${SHERLOCK.id}/season/2`);
  });

  test("eski ?sezon= bağlantıları yeni sezon adresine yönlenir", async ({ page }) => {
    await page.goto(`/series/${SHERLOCK.id}?sezon=2`);
    await expect(page).toHaveURL(`/series/${SHERLOCK.id}/season/2`);
    await expect(page.getByText("S02E01")).toBeVisible();
  });

  test("ilk bölümde önceki, son bölümde sonraki bağlantısı yoktur", async ({ page }) => {
    await page.goto(`/series/${SHERLOCK.id}/season/1/episode/1`);
    const nav = page.getByRole("navigation", { name: "Bölüm gezinmesi" });
    await expect(nav.getByRole("link", { name: /Sonraki bölüm/ })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Önceki bölüm/ })).toHaveCount(0);

    await page.goto(`/series/${SHERLOCK.id}/season/4/episode/3`);
    await expect(
      page.getByRole("navigation", { name: "Bölüm gezinmesi" }).getByRole("link", { name: /Önceki bölüm/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Bölüm gezinmesi" }).getByRole("link", { name: /Sonraki bölüm/ }),
    ).toHaveCount(0);
  });

  for (const path of [
    "/series/abc",
    "/series/99999999",
    `/series/${SHERLOCK.id}/season/9`,
    `/series/${SHERLOCK.id}/season/abc`,
    `/series/${SHERLOCK.id}/season/9/episode/1`,
    `/series/${SHERLOCK.id}/season/1/episode/99`,
    "/olmayan-sayfa",
    "/movie/abc",
    "/movie/999999999",
  ]) {
    test(`bulunamayan sayfa: ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "Sayfa bulunamadı" })).toBeVisible();
    });
  }
});
