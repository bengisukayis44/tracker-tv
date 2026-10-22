import { addToWatchlist, createTestSeries, withDb } from "./db";
import { expect, test } from "./fixtures";

const cron = "/api/cron/new-episodes";
const bearer = () => ({ authorization: `Bearer ${process.env.CRON_SECRET}` });

/*
 * Browsers launched by Playwright cannot subscribe to push (headless has no notifications; automated Chrome
 * gets no push service), so the subscription is put in the database directly and the daily job runs dry.
 */
test.describe("Bildirimler", () => {
  test("günlük görev parolasız çalışmaz", async ({ request }) => {
    expect((await request.get(cron)).status()).toBe(401);
    expect((await request.get(cron, { headers: { authorization: "Bearer yanlis" } })).status()).toBe(401);
  });

  test("ayarlarda bildirim bölümü var", async ({ signedInPage: page }) => {
    await page.goto("/settings");
    const section = page.getByRole("region", { name: "Bildirimler" });
    await expect(section.getByText("yeni bölümü yayınlandığı gün")).toBeVisible();
    // Headless Chromium reports notifications as blocked, which the page explains
    await expect(
      section.getByRole("button", { name: "Bildirimleri aç" }).or(section.getByText(/engellemişsin|desteklemiyor/)),
    ).toBeVisible();
  });

  test("takip edilen dizinin bugün çıkan bölümü için bildirim hazırlanır", async ({ signedInPage: page, account }) => {
    await withDb((db) =>
      db.query(
        `INSERT INTO "PushSubscription" ("id", "userId", "endpoint", "p256dh", "auth")
         VALUES (gen_random_uuid()::text, $1, $2, 'test', 'test')`,
        [account.id, `https://push.example.invalid/${account.id}`],
      ),
    );
    const series = await createTestSeries(0);
    try {
      const planned = async () => {
        const response = await page.request.get(`${cron}?dryRun=1&userId=${account.id}`, { headers: bearer() });
        expect(response.status()).toBe(200);
        return (await response.json()).planned[account.id];
      };
      // Not followed yet: nothing to say
      expect(await planned()).toBeUndefined();

      await addToWatchlist(account.id, series.titleId);
      expect(await planned()).toEqual([
        expect.objectContaining({
          title: `${series.name}: yeni bölüm`,
          body: "S01E02 · Gelecek Bölüm bugün yayında",
          url: expect.stringMatching(/\/season\/1\/episode\/2$/),
        }),
      ]);
    } finally {
      await series.remove();
    }
  });
});
