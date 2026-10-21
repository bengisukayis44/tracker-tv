import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { expectNoHorizontalScroll, INCEPTION, SHERLOCK } from "./helpers";

/** Breaking Bad (TMDB 1396): only used as a "Daha sonra izle" entry. */
const BREAKING_BAD = { id: 1396, name: "Breaking Bad" };

const quickToggle = (page: Page, label: string) =>
  page.getByRole("button", { name: `${label}: izledim olarak işaretle` });

async function watchMovie(page: Page, rating: number) {
  await page.goto(`/movie/${INCEPTION.id}`);
  await page.getByRole("button", { name: "İzledim" }).click();
  await page
    .getByRole("dialog")
    .getByRole("radio", { name: `${rating} puan` })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByRole("heading", { name: "İzledin" })).toBeVisible();
}

test.describe("Profil", () => {
  test("izleme süreleri, sekmeler, favoriler ve yorumlar görünür", async ({ signedInPage: page, account }) => {
    // Sherlock season 1 (3 episodes of ~1.5 hours), a favorite, a comment; Inception watched and a favorite
    await page.goto(`/series/${SHERLOCK.id}/season/1`);
    await page.getByRole("button", { name: "Sezonun tamamını izledim" }).click();
    await expect(page.getByText("3 bölüm izlendi olarak işaretlendi.")).toBeVisible();
    await page.getByRole("button", { name: "Favorilere ekle" }).click();
    await expect(page.getByText("Favorilere eklendi.")).toBeVisible();
    await page.goto(`/series/${SHERLOCK.id}/season/1/episode/3`);
    const comment = `Profil yorumu ${Date.now()}`;
    await page.getByRole("textbox", { name: "Yorumun" }).fill(comment);
    await page.getByRole("button", { name: "Gönder" }).click();
    await expect(page.getByText("Yorumun paylaşıldı.")).toBeVisible();
    await watchMovie(page, 9);
    await page.getByRole("button", { name: "Favorilere ekle" }).click();
    await expect(page.getByText("Favorilere eklendi.")).toBeVisible();

    // The account menu leads to the profile
    await page.getByRole("button", { name: "Hesap menüsü" }).click();
    await page.getByRole("menuitem", { name: "Profilim" }).click();
    await expect(page).toHaveURL(`/profile/${account.username}`);
    await expect(page.getByRole("heading", { level: 1, name: `@${account.username}` })).toBeVisible();

    const time = page.getByRole("region", { name: "İzleme süresi" });
    await expect(time.getByText("3 bölüm")).toBeVisible();
    await expect(time.getByText(/^4 saat$/)).toBeVisible();
    await expect(time.getByText("1 film")).toBeVisible();
    // Inception: 2 sa 28 dk
    await expect(time.getByText(/^2 saat$/)).toBeVisible();

    const tabs = page.getByRole("tablist", { name: "Profil bölümleri" });
    await expect(tabs.getByRole("tab", { name: /İzlediğim Diziler/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel").getByText("3/12 bölüm · %25")).toBeVisible();

    await tabs.getByRole("tab", { name: /İzlediğim Filmler/ }).click();
    await expect(page).toHaveURL(/sekme=filmler/);
    await expect(page.getByRole("tabpanel").getByRole("link", { name: new RegExp(INCEPTION.name) })).toBeVisible();
    await expect(page.getByRole("tabpanel").getByText("Puan: 9/10")).toBeVisible();
    // The chosen tab survives a reload
    await page.reload();
    await expect(tabs.getByRole("tab", { name: /İzlediğim Filmler/ })).toHaveAttribute("aria-selected", "true");

    await tabs.getByRole("tab", { name: /Favorilerim/ }).click();
    const favorites = page.getByRole("tabpanel");
    await expect(favorites.getByRole("heading", { name: "Favori Diziler" })).toBeVisible();
    await expect(favorites.getByRole("link", { name: new RegExp(SHERLOCK.name) })).toBeVisible();
    await expect(favorites.getByRole("heading", { name: "Favori Filmler" })).toBeVisible();
    await expect(favorites.getByRole("link", { name: new RegExp(INCEPTION.name) })).toBeVisible();

    await tabs.getByRole("tab", { name: /Yorumlarım/ }).click();
    const comments = page.getByRole("tabpanel");
    await expect(comments.getByText(comment)).toBeVisible();
    await comments.getByRole("link", { name: /Sherlock — S1 B3:/ }).click();
    await expect(page).toHaveURL(`/series/${SHERLOCK.id}/season/1/episode/3`);

    // Comment authors link to their profile
    await page
      .getByRole("article", { name: `@${account.username} yorumu` })
      .getByRole("link", { name: `@${account.username}` })
      .click();
    await expect(page).toHaveURL(`/profile/${account.username}`);
    await expectNoHorizontalScroll(page);

    // Anyone can see it, worded in the third person
    const visitor = await page.context().browser()!.newPage({ baseURL: test.info().project.use.baseURL });
    try {
      await visitor.goto(`/profile/${account.username}`);
      await expect(visitor.getByRole("tab", { name: /İzlediği Diziler/ })).toBeVisible();
      await expect(visitor.getByText("3/12 bölüm · %25")).toBeVisible();
    } finally {
      await visitor.close();
    }
  });

  test("bilinmeyen kullanıcı için sayfa bulunamadı", async ({ page }) => {
    await page.goto("/profile/boyle-biri-yok-123");
    await expect(page.getByText(/bulunamadı/i).first()).toBeVisible();
  });
});

test.describe("İzleme listem", () => {
  test("giriş yapmamış ziyaretçi giriş sayfasına yönlendirilir", async ({ page }) => {
    await page.goto("/watchlist");
    await expect(page).toHaveURL(`/login?callbackUrl=${encodeURIComponent("/watchlist")}`);
  });

  test("izlemeye devam et sıradaki bölümü gösterir, daha sonra izle listesinden çıkarılır", async ({
    signedInPage: page,
  }) => {
    await page.goto(`/series/${SHERLOCK.id}/season/1`);
    await quickToggle(page, "1. sezon 1. bölüm").click();
    await expect(page.getByLabel("İzleme ilerlemesi")).toContainText("1/12 bölüm izlendi");
    await page.goto(`/series/${BREAKING_BAD.id}`);
    await page.getByRole("button", { name: "Daha sonra izle" }).click();
    await expect(page.getByText("Daha sonra izle listene eklendi.")).toBeVisible();

    // Home page shows both lists
    await page.goto("/");
    const homeContinue = page.getByRole("region", {
      name: "İzlemeye devam et",
    });
    await expect(homeContinue.getByRole("article", { name: SHERLOCK.name })).toContainText("Sıradaki · S01E02");
    await expect(
      page.getByRole("region", { name: "Daha sonra izle" }).getByRole("link", { name: /Breaking Bad/ }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Hesap menüsü" }).click();
    await page.getByRole("menuitem", { name: "İzleme listem" }).click();
    await expect(page).toHaveURL("/watchlist");
    const card = page.getByRole("article", { name: SHERLOCK.name });
    await expect(card).toContainText("Son izlenen: S01E01");
    await expect(card).toContainText("Sıradaki · S01E02");

    // One click marks the next episode and moves on
    await quickToggle(page, `${SHERLOCK.name} 1. sezon 2. bölüm`).click();
    await expect(card).toContainText("Sıradaki · S01E03");

    await page.getByRole("button", { name: `${BREAKING_BAD.name}: listeden kaldır` }).click();
    await expect(page.getByText(`${BREAKING_BAD.name} listenden çıkarıldı.`)).toBeVisible();
    await expect(page.getByRole("region", { name: "Daha sonra izle" }).getByText("Liste boş")).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
