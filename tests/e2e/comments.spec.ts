import type { Page } from "@playwright/test";
import { expect, login, resetAccount, test } from "./fixtures";
import { expectNoHorizontalScroll, INCEPTION, SHERLOCK } from "./helpers";

// Other workers comment on the same pages at the same time, so every check is scoped to this test's own comments
const movieUrl = `/movie/${INCEPTION.id}`;
const episodeUrl = `/series/${SHERLOCK.id}/season/1/episode/3`;
const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const commentsOf = (page: Page, username: string) => page.getByRole("article", { name: `@${username} yorumu` });

async function writeComment(page: Page, text: string, spoiler = false) {
  await page.getByRole("textbox", { name: "Yorumun" }).fill(text);
  if (spoiler) await page.getByLabel("Spoiler içerir").check();
  await page.getByRole("button", { name: "Gönder" }).click();
  await expect(page.getByText("Yorumun paylaşıldı.")).toBeVisible();
}

/** Order of the given texts among all comments on the page, by first appearance. */
async function orderOf(page: Page, texts: string[]) {
  const all = await page.getByRole("article").allInnerTexts();
  return texts.map((t) => all.findIndex((a) => a.includes(t)));
}

test.describe("Yorumlar", () => {
  test("ziyaretçi yorumları görür, yazmak için giriş yapmaya yönlendirilir", async ({ page }) => {
    await page.goto(movieUrl);
    const section = page.getByRole("region", { name: /^Yorumlar/ });
    await expect(section.getByText("Yorum yazmak ve beğenmek için giriş yap.")).toBeVisible();
    await expect(section.getByRole("textbox")).toHaveCount(0);
    await section.getByRole("link", { name: "Giriş yap" }).click();
    await expect(page).toHaveURL(`/login?callbackUrl=${encodeURIComponent(movieUrl)}`);
  });

  test("bölüme yorum yazılır, düzenlenir ve silinir", async ({ signedInPage: page, account }) => {
    const text = `Harika bir bölüm ${unique()}`;
    const edited = `${text} (ikinci düşünce)`;
    await page.goto(episodeUrl);

    await writeComment(page, text);
    const mine = commentsOf(page, account.username).filter({ hasText: text });
    await expect(mine).toBeVisible();
    await expect(mine.getByText("Sen", { exact: true })).toBeVisible();
    // Your own comment can be edited and deleted but not liked
    await expect(mine.getByRole("button", { name: /^Beğen/ })).toHaveCount(0);

    // "(düzenlendi)" appears only for edits made a moment after posting
    await page.waitForTimeout(1200);
    await mine.getByRole("button", { name: "Düzenle" }).click();
    await page.getByRole("textbox", { name: "Yorumu düzenle" }).fill(edited);
    await page.getByRole("button", { name: "Kaydet" }).click();
    await expect(page.getByText("Yorumun güncellendi.")).toBeVisible();
    const updated = commentsOf(page, account.username).filter({ hasText: edited });
    await expect(updated).toBeVisible();
    await expect(updated.getByText("(düzenlendi)")).toBeVisible();

    await updated.getByRole("button", { name: "Sil" }).click();
    const dialog = page.getByRole("dialog", { name: "Yorumu sil?" });
    await dialog.getByRole("button", { name: "Sil" }).click();
    await expect(page.getByText("Yorumun silindi.")).toBeVisible();
    await expect(page.getByText(edited)).toHaveCount(0);
    await page.reload();
    await expect(page.getByText(edited)).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });

  test("spoiler gizlenir, beğeni ve sıralama çalışır, izleyene spoiler açık gelir", async ({
    signedInPage: page,
    account,
    otherAccount,
  }) => {
    await resetAccount(otherAccount);
    const id = unique();
    const spoiler = `Sonunda topaç dönmeye devam ediyor ${id}`;
    const plain = `Müzikleri çok iyi ${id}`;

    await page.goto(movieUrl);
    await writeComment(page, spoiler, true);
    await writeComment(page, plain);
    // The author always sees their own spoiler
    await expect(page.getByText(spoiler)).toBeVisible();

    // Another account that has not watched the movie
    const other = await page.context().browser()!.newPage({ baseURL: test.info().project.use.baseURL });
    try {
      await login(other, otherAccount);
      await other.goto(movieUrl);
      const hidden = commentsOf(other, account.username).filter({ hasText: "Bu yorum spoiler içeriyor" });
      await expect(hidden).toHaveCount(1);
      await expect(other.getByText(spoiler)).toHaveCount(0);
      await hidden.getByRole("button", { name: "Spoiler'ı göster" }).click();
      await expect(other.getByText(spoiler)).toBeVisible();

      // Like the spoiler comment
      const liked = commentsOf(other, account.username).filter({ hasText: spoiler });
      await liked.getByRole("button", { name: "Beğen, 0 beğeni" }).click();
      await expect(liked.getByRole("button", { name: "Beğen, 1 beğeni" })).toHaveAttribute("aria-pressed", "true");

      // Most liked puts the liked (older) comment first; newest puts the plain one first
      const sorting = other.getByRole("group", { name: "Yorum sıralaması" });
      await sorting.getByRole("button", { name: "En beğenilen" }).click();
      await expect(sorting.getByRole("button", { name: "En beğenilen" })).toHaveAttribute("aria-pressed", "true");
      const [likedFirst, plainSecond] = await orderOf(other, [spoiler, plain]);
      expect(likedFirst).toBeLessThan(plainSecond);
      await sorting.getByRole("button", { name: "En yeni" }).click();
      const [spoilerAfter, plainBefore] = await orderOf(other, [spoiler, plain]);
      expect(plainBefore).toBeLessThan(spoilerAfter);

      // After watching the movie, spoilers are shown without asking
      await other.getByRole("button", { name: "İzledim" }).click();
      await other.getByRole("dialog").getByRole("button", { name: "Kaydet" }).click();
      await expect(other.getByRole("heading", { name: "İzledin" })).toBeVisible();
      await other.reload();
      await expect(other.getByText(spoiler)).toBeVisible();
      await expectNoHorizontalScroll(other);

      // The author sees the like count (checked before the reset below removes the like)
      await page.reload();
      await expect(commentsOf(page, account.username).filter({ hasText: spoiler }).getByLabel("1 beğeni")).toBeVisible();
    } finally {
      await other.close();
      await resetAccount(otherAccount);
    }
  });
});
