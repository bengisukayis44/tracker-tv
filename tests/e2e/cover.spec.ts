import { withDb } from "./db";
import { expect, test } from "./fixtures";
import { SHERLOCK } from "./helpers";

/** Marks Sherlock S1E1 watched for the account, straight in the database. */
const watchSherlock = (userId: string) =>
  withDb((db) =>
    db.query(
      `INSERT INTO "WatchedEpisode" ("id", "userId", "episodeId")
       SELECT gen_random_uuid()::text, $1, e."id"
       FROM "Episode" e JOIN "Season" s ON s."id" = e."seasonId" JOIN "Title" t ON t."id" = s."titleId"
       WHERE t."tmdbId" = $2 AND t."type" = 'SERIES' AND s."seasonNumber" = 1 AND e."episodeNumber" = 1`,
      [userId, SHERLOCK.id],
    ),
  );

test.describe("Profil kapağı", () => {
  test("izlenen diziden sahne seçilir, profilde görünür, gizlide saklanır, kaldırılır", async ({
    signedInPage: page,
    account,
  }) => {
    await watchSherlock(account.id);
    await page.goto(`/profile/${account.username}`);
    await expect(page.getByRole("img", { name: "Profil kapağı" })).toHaveCount(0);

    await page.getByRole("button", { name: "Kapak ekle" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Kapak için bir dizi ya da film seç" })).toBeVisible();
    await dialog.getByRole("button", { name: SHERLOCK.name }).click();
    await expect(dialog.getByRole("heading", { name: SHERLOCK.name })).toBeVisible();
    // The ten best images first, then more on demand
    const images = dialog.getByRole("button", { name: /\. görseli kapak yap$/ });
    await expect(images).toHaveCount(10);
    const more = dialog.getByRole("button", { name: /^Daha fazla göster/ });
    const total = 10 + Number((await more.textContent())!.match(/\((\d+) görsel daha\)/)![1]);
    await more.click();
    await expect(images).toHaveCount(Math.min(total, 30));

    // Episode stills, one per episode, labelled with the episode
    await dialog.getByRole("tab", { name: /Bölüm kareleri/ }).click();
    const still = dialog.getByRole("button", { name: /^S01E01 · .+ karesini kapak yap$/ });
    await expect(still).toBeVisible();
    await still.click();

    await expect(page.getByText("Profil kapağın güncellendi.")).toBeVisible();
    const cover = page.getByRole("img", { name: "Profil kapağı" });
    await expect(cover).toHaveAttribute("src", /image\.tmdb\.org/);
    await expect(page.getByRole("button", { name: "Kapağı değiştir" })).toBeVisible();

    // "Konumu ayarla": the arrow buttons and dragging move the visible part; saved for everyone
    const position = () => cover.evaluate((img: HTMLImageElement) => img.style.objectPosition);
    expect(await position()).toBe("50% 50%");
    await page.getByRole("button", { name: "Konumu ayarla" }).click();
    await page.getByRole("button", { name: "Görseli aşağı kaydır" }).click();
    await page.getByRole("button", { name: "Görseli aşağı kaydır" }).click();
    expect(await position()).toBe("50% 40%");
    const box = (await cover.boundingBox())!;
    await page.mouse.move(box.x + box.width / 3, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 3, box.y + box.height / 2 + 40, { steps: 5 });
    await page.mouse.up();
    const dragged = Number((await position()).split(" ")[1].replace("%", ""));
    expect(dragged).toBeLessThan(40);
    await page.getByRole("button", { name: "Kaydet" }).click();
    await expect(page.getByText("Kapağın konumu kaydedildi.")).toBeVisible();
    await page.reload();
    expect(await position()).toBe(`50% ${dragged}%`);

    // Others see it too, unless the profile is private
    const visitor = await page.context().browser()!.newPage({ baseURL: test.info().project.use.baseURL });
    try {
      await visitor.goto(`/profile/${account.username}`);
      await expect(visitor.getByRole("img", { name: "Profil kapağı" })).toBeVisible();
      await expect(visitor.getByRole("button", { name: "Kapağı değiştir" })).toHaveCount(0);
      await withDb((db) => db.query(`UPDATE "User" SET "isPrivate" = true WHERE "id" = $1`, [account.id]));
      await visitor.reload();
      await expect(visitor.getByText("Bu profil gizli")).toBeVisible();
      await expect(visitor.getByRole("img", { name: "Profil kapağı" })).toHaveCount(0);
    } finally {
      await visitor.close();
    }

    await page.getByRole("button", { name: "Kapağı kaldır" }).click();
    await expect(page.getByText("Profil kapağın kaldırıldı.")).toBeVisible();
    await expect(page.getByRole("img", { name: "Profil kapağı" })).toHaveCount(0);
  });

  test("hiçbir şey izlemeyen kullanıcıya açıklama gösterilir", async ({ signedInPage: page }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: "Kapak ekle" }).click();
    await expect(page.getByRole("dialog").getByText("Henüz bir dizi bölümü ya da film izlemedin.")).toBeVisible();
  });
});
