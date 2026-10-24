import { describe, expect, it } from "vitest";
import { nameMatches } from "@/lib/name-match";

describe("nameMatches", () => {
  it("matches the start of any word, in any order", () => {
    expect(nameMatches("Benedict Cumberbatch", "cumber")).toBe(true);
    expect(nameMatches("Benedict Cumberbatch", "cumberbatch benedict")).toBe(true);
    expect(nameMatches("Benedict Cumberbatch", "Benedict C")).toBe(true);
  });

  it("ignores case and accents, Turkish letters included", () => {
    expect(nameMatches("Şükrü Özyıldız", "sukru ozyildiz")).toBe(true);
    expect(nameMatches("İlker Kaleli", "ilker")).toBe(true);
    expect(nameMatches("Penélope Cruz", "penelope")).toBe(true);
  });

  it("does not match words in the middle or a missing word", () => {
    expect(nameMatches("Benedict Cumberbatch", "batch")).toBe(false);
    expect(nameMatches("Benedict Cumberbatch", "benedict wong")).toBe(false);
    expect(nameMatches("Benedict Cumberbatch", "  ")).toBe(false);
  });
});
