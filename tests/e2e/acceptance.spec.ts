import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, login, test } from "./fixtures";
import { expectNoHorizontalScroll, INCEPTION, SHERLOCK } from "./helpers";

/**
 * PROJE_PLANI.md §7 (Kabul kriterleri) checks not covered elsewhere, plus a sweep over every main page:
 * no sideways scrolling and no WCAG 2.1 A/AA problems found by axe, on desktop and phone (both projects).
 */

const episode = `/series/${SHERLOCK.id}/season/1/episode/1`;
const visitorPages = [
  "/",
  "/search?q=sherlock",
  `/series/${SHERLOCK.id}`,
  episode,
  `/movie/${INCEPTION.id}`,
  "/login",
  "/register",
  "/olmayan-sayfa",
];
const memberPages = ["/", "/akis", "/watchlist", "/settings", episode];

async function sweep(page: Page, urls: string[]) {
  const problems: string[] = [];
  for (const url of urls) {
    await page.goto(url);
    await page.locator("main").waitFor();
    await expectNoHorizontalScroll(page);
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    for (const v of violations) {
      problems.push(`${url}: ${v.id} – ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`);
    }
  }
  expect(problems, problems.join("\n")).toEqual([]);
}

test.describe("Kabul kriterleri", () => {
  test("1: diziyi arayıp bölüm sayfasına gidilir; puan ve açıklama görünür", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("searchbox").or(page.getByLabel("Dizi ya da film ara")).first().fill("Sherlock");
    await page.getByRole("button", { name: "Ara" }).click();
    await page.locator(`a[href="/series/${SHERLOCK.id}"]`).first().click();
    await page.getByRole("link", { name: /Pembe Üzerine Bir Çalışma/ }).click();
    await expect(page).toHaveURL(episode);
    await expect(page.getByTitle(/(IMDb|TMDB) puanı/).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Özet" })).toBeVisible();
    await expect(page.getByText("Bu bölüm için açıklama mevcut değil.")).toHaveCount(0);
  });

  test("3: bölüme yazılan spoiler başkasına gizli, tıklayınca açılır", async ({
    signedInPage: page,
    account,
    otherAccount,
  }) => {
    const text = `Bölüm spoiler'ı ${Date.now()}`;
    await page.goto(`/series/${SHERLOCK.id}/season/1/episode/2`);
    await page.getByRole("textbox", { name: "Yorumun" }).fill(text);
    await page.getByLabel("Spoiler içerir").check();
    await page.getByRole("button", { name: "Gönder" }).click();
    await expect(page.getByText(text)).toBeVisible();

    const other = await page.context().browser()!.newPage({ baseURL: test.info().project.use.baseURL });
    try {
      await login(other, otherAccount);
      await other.goto(`/series/${SHERLOCK.id}/season/1/episode/2`);
      const mine = other
        .getByRole("article", { name: `@${account.username} yorumu` })
        .filter({ hasText: "Bu yorum spoiler içeriyor" });
      await expect(mine).toHaveCount(1);
      await expect(other.getByText(text)).toHaveCount(0);
      await mine.getByRole("button", { name: "Spoiler'ı göster" }).click();
      await expect(other.getByText(text)).toBeVisible();
    } finally {
      await other.close();
    }
  });

  test("9: ana sayfalar taşmıyor ve erişilebilirlik sorunu yok (ziyaretçi)", async ({ page }) => {
    await sweep(page, visitorPages);
  });

  test("9: ana sayfalar taşmıyor ve erişilebilirlik sorunu yok (üye)", async ({ signedInPage: page, account }) => {
    await sweep(page, [...memberPages, `/profile/${account.username}`]);
  });

  test("sayfa değişirken üstte yükleniyor çubuğu görünür", async ({ page }) => {
    await page.goto("/");
    // Slow the page data down so the bar has time to show
    await page.route(/[?&]_rsc=/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await page.getByRole("navigation", { name: "Ana bölümler" }).getByRole("link", { name: "Ara" }).click();
    const bar = page.getByRole("progressbar", { name: "Sayfa yükleniyor" });
    await expect(bar).toBeVisible();
    await expect(page).toHaveURL("/search");
    await expect(bar).toHaveCount(0);
  });
});
