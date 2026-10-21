import { expect, type Page } from "@playwright/test";

/** Sherlock (TMDB 19885): 4 seasons of 3 episodes plus specials, ended — a small, stable show. */
export const SHERLOCK = { id: 19885, name: "Sherlock" };

/** Inception (TMDB 27205), shown with its Turkish title. */
export const INCEPTION = { id: 27205, name: "Başlangıç", imdbId: "tt1375666" };

/** A unique test account per call; e-mails ending in @e2e.test are deleted after the run. */
export function newTestUser() {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return { username: `e2e_${suffix}`.slice(0, 20), email: `e2e-${suffix}@e2e.test`, password: "test-sifre-123" };
}

export async function register(page: Page, user: ReturnType<typeof newTestUser>) {
  await page.goto("/register");
  await page.getByLabel("Kullanıcı adı").fill(user.username);
  await page.getByLabel("E-posta").fill(user.email);
  await page.getByLabel("Şifre").fill(user.password);
  await page.getByRole("button", { name: "Kayıt ol" }).click();
  await expect(page.getByRole("heading", { name: `Hoş geldin, @${user.username}` })).toBeVisible();
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Hesap menüsü" }).click();
  await page.getByRole("menuitem", { name: "Çıkış yap" }).click();
  await expect(page.getByRole("link", { name: "Giriş yap" }).first()).toBeVisible();
}

/** The page must not scroll sideways (a common mobile layout bug). */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}
