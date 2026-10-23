import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { test as base, expect, type Page } from "@playwright/test";
import { Client } from "pg";
import { newTestUser } from "./helpers";

/**
 * Test accounts without hitting Supabase's sign-up rate limit:
 * each worker creates its accounts once through the Supabase Admin API, logs in once through the UI
 * and reuses the session; every test starts with that account's tracking data wiped.
 */

export type TestAccount = ReturnType<typeof newTestUser> & { id: string };

async function createAccount(): Promise<TestAccount> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("E2E testleri için NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SECRET_KEY gerekli.");

  const user = newTestUser();
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { username: user.username },
  });
  if (error || !data.user) throw new Error(`Test hesabı oluşturulamadı: ${error?.message}`);
  return { ...user, id: data.user.id };
}

/** Removes everything the account has tracked, so each test starts clean. */
export async function resetAccount(account: TestAccount) {
  // Short jobs go through the transaction pooler; the session pooler's 15 clients are left to the test server
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    for (const table of ["WatchedEpisode", "WatchedMovie", "Favorite", "WatchlistItem", "CommentLike", "Comment"]) {
      await db.query(`DELETE FROM "${table}" WHERE "userId" = $1`, [account.id]);
    }
    await db.query(`DELETE FROM "Follow" WHERE "followerId" = $1 OR "followingId" = $1`, [account.id]);
    await db.query(`DELETE FROM "PushSubscription" WHERE "userId" = $1`, [account.id]);
    await db.query(`DELETE FROM "List" WHERE "userId" = $1`, [account.id]);
    await db.query(
      `UPDATE "User" SET "isPrivate" = false, "avatarUrl" = NULL, "coverPath" = NULL, "coverPositionY" = 50, "coverCharacterTitleId" = NULL, "coverCharacterCastId" = NULL, "username" = $2 WHERE "id" = $1`,
      [account.id, account.username],
    );
  } finally {
    await db.end();
  }
}

export async function login(page: Page, account: Pick<TestAccount, "username" | "password">) {
  await page.goto("/login");
  await page.getByLabel("E-posta veya kullanıcı adı").fill(account.username);
  await page.getByLabel("Şifre").fill(account.password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page.getByRole("heading", { name: `Hoş geldin, @${account.username}` })).toBeVisible();
}

type WorkerFixtures = {
  account: TestAccount;
  otherAccount: TestAccount;
  accountState: string;
};
type TestFixtures = {
  /** A page signed in as `account`, whose tracking data was just reset. */
  signedInPage: Page;
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  account: [async ({}, provide) => provide(await createAccount()), { scope: "worker" }],
  otherAccount: [async ({}, provide) => provide(await createAccount()), { scope: "worker" }],

  // Log in once per worker and keep the cookies for every test of that worker
  accountState: [
    async ({ browser, account }, provide, workerInfo) => {
      const file = path.join("playwright", ".auth", `${workerInfo.project.name}-${workerInfo.workerIndex}.json`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const context = await browser.newContext({ baseURL: workerInfo.project.use.baseURL });
      await login(await context.newPage(), account);
      await context.storageState({ path: file });
      await context.close();
      await provide(file);
    },
    { scope: "worker" },
  ],

  signedInPage: async ({ browser, account, accountState }, provide, testInfo) => {
    await resetAccount(account);
    const context = await browser.newContext({ ...testInfo.project.use, storageState: accountState });
    const page = await context.newPage();
    await provide(page);
    await context.close();
  },
});

export { expect };
