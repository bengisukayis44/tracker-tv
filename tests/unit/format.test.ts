import { describe, expect, it } from "vitest";
import {
  episodeCode,
  formatDate,
  formatRuntime,
  formatWatchTime,
  genreLabel,
  pickRating,
  statusLabel,
} from "@/lib/format";

describe("formatRuntime", () => {
  it("returns null for missing or zero runtime", () => {
    expect(formatRuntime(null)).toBeNull();
    expect(formatRuntime(undefined)).toBeNull();
    expect(formatRuntime(0)).toBeNull();
  });

  it("formats minutes, whole hours and hours with minutes", () => {
    expect(formatRuntime(45)).toBe("45 dk");
    expect(formatRuntime(60)).toBe("1 sa");
    expect(formatRuntime(90)).toBe("1 sa 30 dk");
    expect(formatRuntime(125)).toBe("2 sa 5 dk");
  });
});

describe("episodeCode", () => {
  it("pads season and episode to two digits", () => {
    expect(episodeCode(1, 5)).toBe("S01E05");
    expect(episodeCode(12, 103)).toBe("S12E103");
    expect(episodeCode(0, 1)).toBe("S00E01");
  });
});

describe("formatDate", () => {
  it("formats dates in Turkish", () => {
    expect(formatDate(new Date("2010-07-25T20:00:00Z"))).toBe("25 Temmuz 2010");
    expect(formatDate("2012-01-01T12:00:00Z")).toBe("1 Ocak 2012");
  });

  it("returns null without a date", () => {
    expect(formatDate(null)).toBeNull();
  });
});

describe("labels", () => {
  it("translates known statuses and genres, passes unknown ones through", () => {
    expect(statusLabel("Returning Series")).toBe("Devam ediyor");
    expect(statusLabel("Canceled")).toBe("İptal edildi");
    expect(statusLabel("Ended")).toBe("Final yaptı");
    expect(statusLabel("Something new")).toBe("Something new");
    expect(statusLabel(null)).toBeNull();
    expect(genreLabel("Science-Fiction")).toBe("Bilim kurgu");
    expect(genreLabel("Unknown")).toBe("Unknown");
  });
});

describe("pickRating", () => {
  it("prefers IMDb, falls back to TMDB, and labels the source", () => {
    expect(pickRating(8.7, 9.1)).toEqual({ value: 8.7, source: "IMDb" });
    expect(pickRating(null, 9.1)).toEqual({ value: 9.1, source: "TMDB" });
    expect(pickRating(0, 9.1)).toEqual({ value: 0, source: "IMDb" });
    expect(pickRating(null, null)).toBeNull();
  });
});

describe("formatWatchTime", () => {
  const HOUR = 60;
  const DAY = 24 * HOUR;
  const MONTH = 30 * DAY;

  it.each([
    [0, "0 saat"],
    [45, "45 dakika"],
    [60, "1 saat"],
    [3 * HOUR + 59, "3 saat"],
    [DAY, "1 gün"],
    [2 * DAY + 5 * HOUR, "2 gün 5 saat"],
    [MONTH, "1 ay"],
    [3 * MONTH + 2 * DAY + 4 * HOUR, "3 ay 2 gün 4 saat"],
    [MONTH + 7 * HOUR, "1 ay 7 saat"],
    [12 * DAY + 7 * HOUR, "12 gün 7 saat"],
    [-10, "0 saat"],
  ])("%i dakika → %s", (minutes, expected) => {
    expect(formatWatchTime(minutes)).toBe(expected);
  });
});
