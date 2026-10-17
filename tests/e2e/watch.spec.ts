import type { Page } from "@playwright/test";
import { expect, login, test } from "./fixtures";
import { logout, SHERLOCK } from "./helpers";

const seriesUrl = (season?: number) => `/series/${SHERLOCK.id}${season ? `/season/${season}` : ""}`;
const episodeUrl = (season: number, episode: number) => `${seriesUrl(season)}/episode/${episode}`;

const progress = (page: Page) => page.getByLabel("İzleme ilerlemesi");
const toggle = (
  page: Page,
  season: number,
  episode: number,
  action: "izledim olarak işaretle" | "izlendi, işareti kaldır",
) => page.getByRole("button", { name: `${season}. sezon ${episode}. bölüm: ${action}` });

test.describe("İzleme takibi", () => {
  test("giriş yapmamış ziyaretçi giriş sayfasına yönlendirilir ve geri döner", async ({ page, account }) => {
    await page.goto(seriesUrl());
    await expect(progress(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Favorilere ekle" }).click();
    await expect(page).toHaveURL(`/login?callbackUrl=${encodeURIComponent(seriesUrl())}`);

    await page.getByLabel("E-posta veya kullanıcı adı").fill(account.username);
    await page.getByLabel("Şifre").fill(account.password);
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await expect(page).toHaveURL(seriesUrl());
    await expect(progress(page)).toContainText("0/12 bölüm izlendi");

    // The same from an episode page
    await logout(page);
    await page.goto(episodeUrl(1, 1));
    await page.getByRole("button", { name: "İzledim" }).click();
    await expect(page).toHaveURL(/\/login\?callbackUrl=/);
  });

  test("listeden hızlı işaretleme, önceki bölümleri işaretleme önerisi ve ilerleme", async ({ signedInPage: page }) => {
    await page.goto(seriesUrl(2));
    await expect(progress(page)).toContainText("0/12 bölüm izlendi");

    await toggle(page, 2, 2, "izledim olarak işaretle").click();

    // S01E01-03 and S02E01 come before it; the question is modal, so it is answered first
    const prompt = page.getByRole("dialog", { name: "Önceki 4 bölümü de izledin mi?" });
    await expect(prompt).toBeVisible();
    await prompt.getByRole("button", { name: "Hayır, sadece bu bölüm" }).click();
    await expect(prompt).toBeHidden();
    await expect(progress(page)).toContainText("1/12 bölüm izlendi");
    await expect(toggle(page, 2, 2, "izlendi, işareti kaldır")).toHaveAttribute("aria-pressed", "true");

    // Unmark and mark again, this time accepting
    await toggle(page, 2, 2, "izlendi, işareti kaldır").click();
    await expect(progress(page)).toContainText("0/12 bölüm izlendi");
    await toggle(page, 2, 2, "izledim olarak işaretle").click();
    await prompt.getByRole("button", { name: "Evet, hepsini işaretle" }).click();
    await expect(prompt).toBeHidden();
    await expect(page.getByText("4 bölüm izlendi olarak işaretlendi.")).toBeVisible();
    await expect(progress(page)).toContainText("5/12 bölüm izlendi");

    // Undo one
    await toggle(page, 2, 1, "izlendi, işareti kaldır").click();
    await expect(progress(page)).toContainText("4/12 bölüm izlendi");

    // Persists after reload
    await page.reload();
    await expect(progress(page)).toContainText("4/12 bölüm izlendi");
    await expect(toggle(page, 2, 1, "izledim olarak işaretle")).toHaveAttribute("aria-pressed", "false");
  });

  test("sezonun tamamını işaretleme ve geri alma", async ({ signedInPage: page }) => {
    await page.goto(seriesUrl(3));

    await page.getByRole("button", { name: "Sezonun tamamını izledim" }).click();
    await expect(page.getByText("3 bölüm izlendi olarak işaretlendi.")).toBeVisible();
    await expect(progress(page)).toContainText("3/12 bölüm izlendi");
    for (const n of [1, 2, 3]) {
      await expect(toggle(page, 3, n, "izlendi, işareti kaldır")).toBeVisible();
    }

    await page.getByRole("button", { name: "Sezon işaretini kaldır" }).click();
    await expect(progress(page)).toContainText("0/12 bölüm izlendi");
    await expect(page.getByRole("button", { name: "Sezonun tamamını izledim" })).toBeVisible();
  });

  test("İzledim: puan, duygular ve not kaydedilir, düzenlenir ve geri alınır", async ({ signedInPage: page }) => {
    await page.goto(episodeUrl(1, 1));

    await page.getByRole("button", { name: "İzledim" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("radio", { name: "8 puan" }).click();
    await dialog.getByRole("button", { name: "Mutlu" }).click();
    await dialog.getByRole("button", { name: "Gergin" }).click();
    await dialog.getByLabel("Kişisel not").fill("Watson'ın blogu çok iyi.");
    await dialog.getByRole("button", { name: "Kaydet" }).click();

    await expect(page.getByText("İzledin olarak kaydedildi.")).toBeVisible();
    const panel = page.getByRole("region", { name: "İzledin" });
    await expect(panel.getByText("8/10")).toBeVisible();
    await expect(panel.getByRole("list", { name: "Seçtiğin duygular" })).toHaveText(/Mutlu.*Gergin/);
    await expect(panel.getByText("Watson'ın blogu çok iyi.")).toBeVisible();
    await expect(panel.getByText("Sadece sen görürsün")).toBeVisible();

    // Survives a reload
    await page.reload();
    await expect(page.getByRole("region", { name: "İzledin" }).getByText("8/10")).toBeVisible();

    // Edit: change the rating, drop an emotion, clear the note
    await page.getByRole("button", { name: "Düzenle" }).click();
    await expect(dialog.getByRole("radio", { name: "8 puan" })).toHaveAttribute("aria-checked", "true");
    await dialog.getByRole("radio", { name: "6 puan" }).click();
    await dialog.getByRole("button", { name: "Gergin" }).click();
    await dialog.getByLabel("Kişisel not").fill("");
    await dialog.getByRole("button", { name: "Kaydet" }).click();
    await expect(page.getByText("Kaydın güncellendi.")).toBeVisible();
    await expect(panel.getByText("6/10")).toBeVisible();
    await expect(panel.getByRole("list", { name: "Seçtiğin duygular" })).toHaveText("😊Mutlu");
    await expect(panel.getByText("Sadece sen görürsün")).toHaveCount(0);

    // Undo
    await page.getByRole("button", { name: "İzlenmedi olarak işaretle" }).click();
    await expect(page.getByRole("heading", { name: "Bu bölümü izledin mi?" })).toBeVisible();

    // The series page agrees
    await page.goto(seriesUrl());
    await expect(progress(page)).toContainText("0/12 bölüm izlendi");
  });

  test("İzledim'e puansız da basılabilir ve iptal edilen pencere kayıt oluşturmaz", async ({ signedInPage: page }) => {
    await page.goto(episodeUrl(1, 2));

    await page.getByRole("button", { name: "İzledim" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Vazgeç" }).click();
    await expect(page.getByRole("heading", { name: "Bu bölümü izledin mi?" })).toBeVisible();

    await page.getByRole("button", { name: "İzledim" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Kaydet" }).click();

    // S01E01 is before it and unwatched: answering "no" leaves it unwatched
    const prompt = page.getByRole("dialog", { name: "Önceki 1 bölümü de izledin mi?" });
    await prompt.getByRole("button", { name: "Hayır, sadece bu bölüm" }).click();
    await expect(prompt).toBeHidden();
    const panel = page.getByRole("region", { name: "İzledin" });
    await expect(panel.getByText("Puan vermedin")).toBeVisible();
    await page.goto(seriesUrl());
    await expect(progress(page)).toContainText("1/12 bölüm izlendi");
  });

  test("favoriler ve daha sonra izle; bölüm izleyince listeden çıkar", async ({ signedInPage: page }) => {
    await page.goto(seriesUrl());

    await page.getByRole("button", { name: "Favorilere ekle" }).click();
    await expect(page.getByText("Favorilere eklendi.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Favorilerde" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Daha sonra izle" }).click();
    await expect(page.getByText("Daha sonra izle listene eklendi.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Daha sonra izlenecek" })).toHaveAttribute("aria-pressed", "true");

    await page.reload();
    await expect(page.getByRole("button", { name: "Favorilerde" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Daha sonra izlenecek" })).toBeVisible();

    // Watching an episode takes the show off "Daha sonra izle" (favorites stay)
    await toggle(page, 1, 1, "izledim olarak işaretle").click();
    await expect(progress(page)).toContainText("1/12 bölüm izlendi");
    await expect(page.getByRole("button", { name: "Daha sonra izle", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Favorilerde" })).toBeVisible();

    await page.getByRole("button", { name: "Favorilerde" }).click();
    await expect(page.getByRole("button", { name: "Favorilere ekle" })).toBeVisible();
  });

  test("kullanıcıların kayıtları birbirine görünmez", async ({ signedInPage: page, otherAccount }) => {
    await page.goto(episodeUrl(1, 3));
    await page.getByRole("button", { name: "İzledim" }).click();
    await page.getByRole("dialog").getByLabel("Kişisel not").fill("Gizli notum");
    await page.getByRole("dialog").getByRole("button", { name: "Kaydet" }).click();
    await page
      .getByRole("dialog", { name: "Önceki 2 bölümü de izledin mi?" })
      .getByRole("button", { name: "Hayır, sadece bu bölüm" })
      .click();
    await expect(page.getByText("Gizli notum")).toBeVisible();

    // Another account, in its own browser session
    const other = await page.context().browser()!.newPage({ baseURL: test.info().project.use.baseURL });
    await login(other, otherAccount);
    await other.goto(episodeUrl(1, 3));
    await expect(other.getByRole("heading", { name: "Bu bölümü izledin mi?" })).toBeVisible();
    await expect(other.getByText("Gizli notum")).toHaveCount(0);
    await other.goto(seriesUrl());
    await expect(progress(other)).toContainText("0/12 bölüm izlendi");
    await other.close();
  });
});
