import { expect, login, resetAccount, test } from "./fixtures";
import { SHERLOCK } from "./helpers";

const episode = `/series/${SHERLOCK.id}/season/1/episode/2`;

test.describe("Cevaplar ve bildirimler", () => {
  test("cevap, beğeni ve takip bildirim olarak gelir; cevap yorumun altında görünür", async ({
    signedInPage: page,
    account,
    otherAccount,
  }) => {
    await resetAccount(otherAccount);
    const id = Date.now().toString(36);
    const question = `Bu bölümde katil kimdi sizce? ${id}`;
    const answer = `Bence taksici ${id}`;

    await page.goto(episode);
    await page.getByRole("textbox", { name: "Yorumun" }).fill(question);
    await page.getByRole("button", { name: "Gönder" }).click();
    await expect(page.getByText("Yorumun paylaşıldı.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Bildirimler", exact: true })).toBeVisible();

    const other = await page.context().browser()!.newPage({ baseURL: test.info().project.use.baseURL });
    try {
      await login(other, otherAccount);
      await other.goto(episode);
      const comment = other.getByRole("article", { name: `@${account.username} yorumu` }).filter({ hasText: question });
      await comment.getByRole("button", { name: "Cevapla" }).click();
      // Other test runs comment on the same episode, so everything stays inside this comment
      const form = comment.locator("form");
      await form.getByRole("textbox", { name: "Cevabın" }).fill(answer);
      await form.getByRole("button", { name: "Cevapla" }).click();
      await expect(other.getByText("Cevabın paylaşıldı.")).toBeVisible();
      const thread = other.getByRole("group", { name: `@${account.username} yorumuna cevaplar` });
      await expect(thread.getByText(answer)).toBeVisible();
      await comment.getByRole("button", { name: /^Beğen/ }).click();
      await expect(comment.getByRole("button", { name: "Beğen, 1 beğeni" })).toBeVisible();
      await other.goto(`/profile/${account.username}`);
      await other.getByRole("button", { name: `@${account.username} takip et` }).click();
      await expect(other.getByText(`@${account.username} takip ediliyor.`)).toBeVisible();
    } finally {
      await other.close();
    }

    // The bell counts three, the page lists them, opening it reads them
    await page.goto("/");
    const bell = page.getByRole("link", { name: "Bildirimler, 3 okunmamış" });
    await expect(bell).toBeVisible();
    await bell.click();
    await expect(page).toHaveURL("/bildirimler");
    const items = page.getByRole("listitem");
    await expect(items.filter({ hasText: "seni takip etmeye başladı" })).toContainText(`@${otherAccount.username}`);
    await expect(items.filter({ hasText: "yorumunu beğendi" })).toContainText(question);
    const reply = items.filter({ hasText: "yorumuna cevap verdi" });
    await expect(reply).toContainText(`(${SHERLOCK.name} S1 B2)`);
    await expect(reply).toContainText(answer);
    await expect(page.getByRole("link", { name: "Bildirimler", exact: true })).toBeVisible();

    // The reply notification opens the conversation
    await reply.getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`${episode}#yorum-`));
    await expect(page.getByRole("group", { name: `@${account.username} yorumuna cevaplar` })).toContainText(answer);
    await resetAccount(otherAccount);
  });

  test("ziyaretçi cevaplamak için giriş yapar, bildirim sayfası giriş ister", async ({ page }) => {
    await page.goto("/bildirimler");
    await expect(page).toHaveURL(`/login?callbackUrl=${encodeURIComponent("/bildirimler")}`);
  });
});
