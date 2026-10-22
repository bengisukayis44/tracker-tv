import sharp from "sharp";
import { expect, test } from "./fixtures";

const tabs = (page: import("@playwright/test").Page) => page.getByRole("navigation", { name: "Ana bölümler" });

test.describe("Ayarlar", () => {
  test("giriş yapmamış ziyaretçi giriş sayfasına yönlendirilir", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(`/login?callbackUrl=${encodeURIComponent("/settings")}`);
  });

  test("profil fotoğrafı yüklenir ve kaldırılır", async ({ signedInPage: page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Hesap menüsü" }).click();
    await page.getByRole("menuitem", { name: "Ayarlar" }).click();
    await expect(page).toHaveURL("/settings");

    // A large, non-square photo: shrunk in the browser, squared on the server
    const photo = await sharp({ create: { width: 1600, height: 900, channels: 3, background: "#7c3aed" } })
      .jpeg()
      .toBuffer();
    await page
      .getByLabel("Profil fotoğrafı seç")
      .setInputFiles({ name: "foto.jpg", mimeType: "image/jpeg", buffer: photo });
    await expect(page.getByText("Profil fotoğrafın güncellendi.")).toBeVisible();
    const avatar = page.getByRole("img", { name: "Profil fotoğrafın" });
    await expect(avatar).toHaveAttribute("src", /\/storage\/v1\/object\/public\/avatars\/.+\.webp$/);
    const size = await avatar.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight]);
    expect(size).toEqual([256, 256]);

    await page.getByRole("button", { name: "Kaldır" }).click();
    await expect(page.getByText("Profil fotoğrafın kaldırıldı.")).toBeVisible();
    await expect(page.getByRole("img", { name: "Profil fotoğrafın" })).toHaveCount(0);
  });

  test("kullanıcı adı değişir; alınmış ad kabul edilmez", async ({ signedInPage: page, account }) => {
    const renamed = `${account.username.slice(0, 16)}_yen`;
    await page.goto("/settings");
    const section = page.getByRole("region", { name: "Kullanıcı adı" });
    const field = section.getByRole("textbox", { name: "Kullanıcı adı" });

    await field.fill("Ab");
    await page.getByRole("button", { name: "Kaydet" }).click();
    await expect(section.getByRole("alert")).toContainText("en az 3 karakter");

    // A real user's name
    await field.fill("bengisukayis");
    await page.getByRole("button", { name: "Kaydet" }).click();
    await expect(section.getByRole("alert")).toHaveText("Bu kullanıcı adı alınmış.");

    await field.fill(renamed);
    await page.getByRole("button", { name: "Kaydet" }).click();
    await expect(page.getByText("Kullanıcı adın güncellendi.")).toBeVisible();
    // The tab follows the new name once the page has refreshed
    const profileTab = tabs(page).getByRole("link", { name: "Profilim" });
    await expect(profileTab).toHaveAttribute("href", `/profile/${renamed}`);
    await profileTab.click();
    await expect(page).toHaveURL(`/profile/${renamed}`);
    await expect(page.getByRole("heading", { level: 1, name: `@${renamed}` })).toBeVisible();
    // The account's name is restored before the next test (signedInPage fixture)
  });

  test("gizli profil başkalarına kapalı, sahibine açık", async ({ signedInPage: page, account }) => {
    await page.goto(`/profile/${account.username}`);
    await page.getByRole("link", { name: "Profili düzenle" }).click();
    await page.getByLabel(/Profilimi gizle/).check();
    await expect(page.getByText("Profilin artık gizli.")).toBeVisible();

    await page.goto(`/profile/${account.username}`);
    await expect(page.getByRole("tablist", { name: "Profil bölümleri" })).toBeVisible();

    const visitor = await page.context().browser()!.newPage({ baseURL: test.info().project.use.baseURL });
    try {
      await visitor.goto(`/profile/${account.username}`);
      await expect(visitor.getByText("Bu profil gizli")).toBeVisible();
      await expect(visitor.getByRole("tablist")).toHaveCount(0);
      await expect(visitor.getByText("Dizi izleme süresi")).toHaveCount(0);
    } finally {
      await visitor.close();
    }

    await page.goto("/settings");
    await page.getByLabel(/Profilimi gizle/).uncheck();
    await expect(page.getByText("Profilin artık herkese açık.")).toBeVisible();
  });
});
