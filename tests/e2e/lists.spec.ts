import { expect, test } from "./fixtures";
import { INCEPTION, SHERLOCK } from "./helpers";

test.describe("Kendi listeler", () => {
  test("ziyaretçi Listeye ekle'ye basınca giriş sayfasına gider", async ({ page }) => {
    await page.goto(`/series/${SHERLOCK.id}`);
    await page.getByRole("button", { name: "Listeye ekle" }).click();
    await expect(page).toHaveURL(`/login?callbackUrl=${encodeURIComponent(`/series/${SHERLOCK.id}`)}`);
  });

  test("liste oluşturulur, dizi ve film eklenir, düzenlenir, gizlenir ve silinir", async ({
    signedInPage: page,
    account,
  }) => {
    // First list, straight from a series page
    await page.goto(`/series/${SHERLOCK.id}`);
    await page.getByRole("button", { name: "Listeye ekle" }).click();
    const dialog = page.getByRole("dialog", { name: "Listeye ekle" });
    await dialog.getByLabel("Liste adı").fill("Dedektifler");
    await dialog.getByRole("button", { name: "Oluştur ve ekle" }).click();
    await expect(page.getByText("Dedektifler listesi oluşturuldu.")).toBeVisible();
    await expect(dialog.getByRole("checkbox", { name: /Dedektifler/ })).toBeChecked();
    await page.keyboard.press("Escape");

    // A movie into the same list
    await page.goto(`/movie/${INCEPTION.id}`);
    await page.getByRole("button", { name: "Listeye ekle" }).click();
    await dialog.getByRole("checkbox", { name: /Dedektifler/ }).check();
    await expect(page.getByText("Dedektifler listesine eklendi.")).toBeVisible();
    await page.keyboard.press("Escape");

    // On the profile, then the list page
    await page.goto(`/profile/${account.username}?sekme=listeler`);
    const card = page.getByRole("tabpanel").getByRole("link", { name: /Dedektifler/ });
    await expect(card).toContainText("2 yapım");
    await card.click();
    await expect(page.getByRole("heading", { level: 1, name: "Dedektifler" })).toBeVisible();
    await expect(page.locator(`a[href="/series/${SHERLOCK.id}"]`)).toBeVisible();
    await expect(page.locator(`a[href="/movie/${INCEPTION.id}"]`)).toBeVisible();
    const listUrl = page.url();

    // Rename, describe and make private: others then cannot open it
    await page.getByRole("button", { name: "Düzenle" }).click();
    const edit = page.getByRole("dialog", { name: "Listeyi düzenle" });
    await edit.getByLabel("Liste adı").fill("En iyi dedektifler");
    await edit.getByLabel(/Açıklama/).fill("Bayıldıklarım");
    await edit.getByLabel(/Herkese açık/).uncheck();
    await edit.getByRole("button", { name: "Kaydet" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "En iyi dedektifler" })).toBeVisible();
    await expect(page.getByText("Bayıldıklarım")).toBeVisible();
    await expect(page.getByLabel("Gizli liste")).toBeVisible();
    const visitor = await page.context().browser()!.newPage({ baseURL: test.info().project.use.baseURL });
    try {
      await visitor.goto(listUrl);
      await expect(visitor.getByRole("heading", { name: "Sayfa bulunamadı" })).toBeVisible();
      await visitor.goto(`/profile/${account.username}?sekme=listeler`);
      await expect(visitor.getByRole("tab", { name: /Listeleri/ })).toContainText("0");
    } finally {
      await visitor.close();
    }

    // Take one out, then delete the list
    await page.getByRole("button", { name: `${SHERLOCK.name}: listeden çıkar` }).click();
    await expect(page.getByText(`${SHERLOCK.name} listeden çıkarıldı.`)).toBeVisible();
    await expect(page.getByText("1 yapım")).toBeVisible();
    await page.getByRole("button", { name: "Listeyi sil" }).click();
    await page.getByRole("dialog", { name: "Listeyi sil?" }).getByRole("button", { name: "Sil" }).click();
    await expect(page).toHaveURL(`/profile/${account.username}`);
    await page.getByRole("tab", { name: /Listelerim/ }).click();
    await expect(page.getByRole("tabpanel").getByText("Liste yok")).toBeVisible();
  });

  test("profilden yeni boş liste oluşturulur", async ({ signedInPage: page, account }) => {
    await page.goto(`/profile/${account.username}?sekme=listeler`);
    await page.getByRole("button", { name: "Yeni liste" }).click();
    const dialog = page.getByRole("dialog", { name: "Yeni liste" });
    await dialog.getByLabel("Liste adı").fill("Hafta sonu");
    await dialog.getByRole("button", { name: "Oluştur" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Hafta sonu" })).toBeVisible();
    await expect(page.getByText("Liste boş")).toBeVisible();
  });
});
