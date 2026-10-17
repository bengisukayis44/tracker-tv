import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
// Set E2E_BASE_URL to run the suite against a deployed site instead of a local production build
const BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;

/**
 * End-to-end tests against a production build (`next build && next start`) on port 3100,
 * using the real Supabase database and TVmaze. Test users are e-mails ending in @e2e.test
 * and are deleted after the run (tests/e2e/global-teardown.ts).
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  // Supabase Auth rate-limits sign-ups per IP, so auth flows run with few workers
  workers: 3,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
  },
  projects: [
    { name: "masaustu", use: { ...devices["Desktop Chrome"] } },
    { name: "mobil", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next build && npx next start -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        env: { NEXT_DIST_DIR: ".next-e2e" },
        timeout: 300_000,
        reuseExistingServer: !process.env.CI,
      },
});
