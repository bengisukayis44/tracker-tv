import { expect, test } from "@playwright/test";
import { logout, newTestUser, register } from "./helpers";

test.describe("Kayıt ve giriş", () => {
  test("kayıt olunca giriş yapılmış olur, çıkış yapılabilir, tekrar giriş yapılabilir", async ({ page }) => {
    const user = newTestUser();
    await register(page, user);
    await expect(page.getByRole("button", { name: "Hesap menüsü" })).toBeVisible();

    // Signed-in users are sent away from the auth pages
    await page.goto("/login");
    await expect(page).toHaveURL("/");

    await logout(page);

    // Log in with the username
    await page.goto("/login");
    await page.getByLabel("E-posta veya kullanıcı adı").fill(user.username);
    await page.getByLabel("Şifre").fill(user.password);
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await expect(page.getByRole("heading", { name: `Hoş geldin, @${user.username}` })).toBeVisible();
    await logout(page);

    // Log in with the e-mail, written in different case
    await page.goto("/login");
    await page.getByLabel("E-posta veya kullanıcı adı").fill(user.email.toUpperCase());
    await page.getByLabel("Şifre").fill(user.password);
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await expect(page.getByRole("heading", { name: `Hoş geldin, @${user.username}` })).toBeVisible();

    // The session survives a reload
    await page.reload();
    await expect(page.getByRole("heading", { name: `Hoş geldin, @${user.username}` })).toBeVisible();
  });

  test("yanlış şifre ve olmayan kullanıcı aynı hata mesajını verir", async ({ page }) => {
    const user = newTestUser();
    await register(page, user);
    await logout(page);

    for (const [identifier, password] of [
      [user.username, "yanlis-sifre-999"],
      ["boyle_biri_yok_123", "bir-sifre-123"],
    ]) {
      await page.goto("/login");
      await page.getByLabel("E-posta veya kullanıcı adı").fill(identifier);
      await page.getByLabel("Şifre").fill(password);
      await page.getByRole("button", { name: "Giriş yap" }).click();
      await expect(page.getByText("E-posta/kullanıcı adı veya şifre hatalı.")).toBeVisible();
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test("alınmış kullanıcı adı ve e-posta ile kayıt olunamaz", async ({ page }) => {
    const user = newTestUser();
    await register(page, user);
    await logout(page);

    const other = newTestUser();
    await page.goto("/register");
    await page.getByLabel("Kullanıcı adı").fill(user.username);
    await page.getByLabel("E-posta").fill(other.email);
    await page.getByLabel("Şifre").fill(other.password);
    await page.getByRole("button", { name: "Kayıt ol" }).click();
    await expect(page.getByText("Bu kullanıcı adı alınmış.")).toBeVisible();

    await page.getByLabel("Kullanıcı adı").fill(other.username);
    await page.getByLabel("E-posta").fill(user.email);
    await page.getByRole("button", { name: "Kayıt ol" }).click();
    await expect(page.getByText("Bu e-posta adresiyle zaten bir hesap var.")).toBeVisible();
  });

  test("form doğrulama hataları sunucuya gitmeden gösterilir", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Kullanıcı adı").fill("AB");
    await page.getByLabel("E-posta").fill("gecersiz");
    await page.getByLabel("Şifre").fill("123");
    await page.getByRole("button", { name: "Kayıt ol" }).click();
    await expect(page.getByText("Kullanıcı adı en az 3 karakter olmalı.")).toBeVisible();
    await expect(page.getByText("Geçerli bir e-posta adresi girin.")).toBeVisible();
    await expect(page.getByText("Şifre en az 8 karakter olmalı.")).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });

  test("giriş sonrası yalnızca site içine yönlendirir", async ({ page }) => {
    const user = newTestUser();
    await register(page, user);
    await logout(page);

    await page.goto("/login?callbackUrl=//evil.example");
    await page.getByLabel("E-posta veya kullanıcı adı").fill(user.username);
    await page.getByLabel("Şifre").fill(user.password);
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await expect(page).toHaveURL("/");
  });
});
