import { beforeEach, describe, expect, it, vi } from "vitest";

// The catalog talks to the database; these tests only cover its pure decision helpers
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { isStale, needsImdbSync } = await import("@/lib/catalog");

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 9, 17);
const daysAgo = (days: number) => new Date(now - days * DAY);

describe("isStale", () => {
  it("is stale when never synced", () => {
    expect(isStale(null, "Running", now)).toBe(true);
  });

  it("refreshes airing shows daily", () => {
    expect(isStale(daysAgo(0.5), "Running", now)).toBe(false);
    expect(isStale(daysAgo(1.1), "Running", now)).toBe(true);
  });

  it("refreshes cancelled shows weekly, like ended ones", () => {
    expect(isStale(daysAgo(3), "Canceled", now)).toBe(false);
    expect(isStale(daysAgo(3), "Returning Series", now)).toBe(true);
  });

  it("refreshes ended shows weekly", () => {
    expect(isStale(daysAgo(3), "Ended", now)).toBe(false);
    expect(isStale(daysAgo(8), "Ended", now)).toBe(true);
  });

  it("treats unknown status like an airing show", () => {
    expect(isStale(daysAgo(2), null, now)).toBe(true);
  });
});

describe("needsImdbSync", () => {
  beforeEach(() => {
    vi.stubEnv("OMDB_API_KEY", "test-key");
  });

  it("syncs titles with an IMDb id that were never or long ago synced", () => {
    expect(needsImdbSync({ imdbId: "tt1", imdbSyncedAt: null }, now)).toBe(true);
    expect(needsImdbSync({ imdbId: "tt1", imdbSyncedAt: daysAgo(8) }, now)).toBe(true);
    expect(needsImdbSync({ imdbId: "tt1", imdbSyncedAt: daysAgo(2) }, now)).toBe(false);
  });

  it("never syncs without an IMDb id or API key", () => {
    expect(needsImdbSync({ imdbId: null, imdbSyncedAt: null }, now)).toBe(false);
    vi.stubEnv("OMDB_API_KEY", "");
    expect(needsImdbSync({ imdbId: "tt1", imdbSyncedAt: null }, now)).toBe(false);
  });
});
