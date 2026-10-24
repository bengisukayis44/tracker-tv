import { withDb } from "./db";
import { createAccount, expect, login, resetAccount, test } from "./fixtures";
import { INCEPTION } from "./helpers";

const makeAdmin = (id: string) => withDb((db) => db.query(`UPDATE "User" SET "isAdmin" = true WHERE "id" = $1`, [id]));

/** A movie comment by `userId`, straight in the database; returns its id. */
async function seedComment(userId: string, content: string) {
  return withDb(async (db) => {
    const { rows } = await db.query(
      `INSERT INTO "Comment" ("id", "userId", "titleId", "content", "updatedAt")
       SELECT gen_random_uuid()::text, $1, "id", $3, now() FROM "Title" WHERE "tmdbId" = $2 AND "type" = 'MOVIE'
       RETURNING "id"`,
      [userId, INCEPTION.id, content],
    );
    return rows[0].id as string;
  });
}

test.describe("Yönetim paneli", () => {
  test("yönetici olmayan panelin varlığını bile görmez", async ({ page, signedInPage }) => {
    for (const p of [page, signedInPage]) {
      for (const url of ["/admin", "/admin/kullanicilar", "/admin/yorumlar"]) {
        await p.goto(url);
        await expect(p.getByRole("heading", { name: "Sayfa bulunamadı" })).toBeVisible();
      }
    }
    await signedInPage.goto("/");
    await signedInPage.getByRole("button", { name: "Hesap menüsü" }).click();
    await expect(signedInPage.getByRole("menuitem", { name: "Ayarlar" })).toBeVisible();
    await expect(signedInPage.getByRole("menuitem", { name: "Yönetim paneli" })).toHaveCount(0);
  });

  test("şikayet edilen yorum panelde görünür; sorun yok ya da sil", async ({
    signedInPage: page,
    account,
    otherAccount,
  }) => {
    await resetAccount(otherAccount);
    const content = `Şikayetlik yorum ${Date.now()}`;
    try {
      const commentId = await seedComment(otherAccount.id, content);

      // A member reports it from the movie page
      await page.goto(`/movie/${INCEPTION.id}`);
      const comment = page.getByRole("article").filter({ hasText: content });
      await comment.getByRole("button", { name: `@${otherAccount.username} yorumunu şikayet et` }).click();
      const dialog = page.getByRole("dialog", { name: "Yorumu şikayet et" });
      await expect(dialog.getByRole("button", { name: "Şikayet et" })).toBeDisabled();
      await dialog.getByLabel("Hakaret veya taciz").check();
      await dialog.getByRole("button", { name: "Şikayet et" }).click();
      await expect(page.getByText("Şikayetin iletildi. Teşekkürler!")).toBeVisible();
      await expect(comment.getByText("Şikayet edildi")).toBeVisible();

      // The admin sees it in the queue
      await makeAdmin(account.id);
      await page.goto("/");
      await page.getByRole("button", { name: "Hesap menüsü" }).click();
      await page.getByRole("menuitem", { name: "Yönetim paneli" }).click();
      await expect(page).toHaveURL("/admin");
      await expect(page.getByRole("heading", { level: 1, name: "Genel bakış" })).toBeVisible();
      await page
        .getByRole("navigation", { name: "Yönetim bölümleri" })
        .getByRole("link", { name: /Yorumlar/ })
        .click();
      await expect(page).toHaveURL("/admin/yorumlar");
      const reported = page.getByRole("article").filter({ hasText: content });
      await expect(reported).toContainText("1 şikayet:");
      await expect(reported).toContainText("Hakaret veya taciz");

      await reported.getByRole("button", { name: "Sorun yok" }).click();
      await expect(page.getByText("Şikayetler kapatıldı.")).toBeVisible();
      await expect(reported).toHaveCount(0);

      // Reported again, this time deleted
      await withDb((db) =>
        db.query(`UPDATE "CommentReport" SET "resolvedAt" = NULL WHERE "commentId" = $1`, [commentId]),
      );
      await page.reload();
      await reported.getByRole("button", { name: "Sil" }).click();
      await page.getByRole("dialog", { name: "Yorumu sil?" }).getByRole("button", { name: "Sil" }).click();
      await expect(page.getByText("Yorum silindi.")).toBeVisible();
      await page.goto(`/movie/${INCEPTION.id}`);
      await expect(page.getByText(content)).toHaveCount(0);
    } finally {
      await resetAccount(otherAccount);
    }
  });

  test("hesap askıya alınır, açılır ve silinir", async ({ signedInPage: page, account, browser }, testInfo) => {
    // Its own account: suspending ends the sessions other tests rely on
    const target = await createAccount();
    await makeAdmin(account.id);

    const other = await browser.newContext({ ...testInfo.project.use });
    try {
      const targetPage = await other.newPage();
      await login(targetPage, target);

      await page.goto(`/admin/kullanicilar/${target.id}`);
      await expect(page.getByRole("heading", { level: 1, name: `@${target.username}` })).toBeVisible();
      await page.getByRole("button", { name: "Askıya al" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Askıya al" }).click();
      await expect(page.getByText(`@${target.username} askıya alındı.`)).toBeVisible();
      await expect(page.getByText(/tarihinden beri askıda/)).toBeVisible();

      // Their open session no longer counts, and they cannot sign in again
      await targetPage.goto("/settings");
      await expect(targetPage).toHaveURL(/\/login/);
      await targetPage.getByLabel("E-posta veya kullanıcı adı").fill(target.username);
      await targetPage.getByLabel("Şifre").fill(target.password);
      await targetPage.getByRole("button", { name: "Giriş yap" }).click();
      await expect(targetPage.getByText("Hesabın askıya alındı. Giriş yapamazsın.")).toBeVisible();

      await page.getByRole("button", { name: "Askıdan çıkar" }).click();
      await expect(page.getByText(`@${target.username} askıdan çıkarıldı.`)).toBeVisible();
      await login(targetPage, target);

      await page.getByRole("button", { name: "Hesabı sil" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Hesabı sil" }).click();
      await expect(page).toHaveURL("/admin/kullanicilar");
      await expect(page.getByText(`@${target.username} hesabı silindi.`)).toBeVisible();
      await page.goto(`/profile/${target.username}`);
      await expect(page.getByRole("heading", { name: "Sayfa bulunamadı" })).toBeVisible();

      // The admin cannot act on themselves
      await page.goto(`/admin/kullanicilar/${account.id}`);
      await expect(page.getByRole("heading", { level: 1, name: `@${account.username}` })).toBeVisible();
      await expect(page.getByRole("button", { name: "Askıya al" })).toHaveCount(0);
    } finally {
      await other.close();
      await withDb((db) => db.query(`DELETE FROM auth.users WHERE "id" = $1`, [target.id]));
    }
  });
});
