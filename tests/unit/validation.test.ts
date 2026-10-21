import { describe, expect, it } from "vitest";
import { safeRedirect } from "@/lib/redirect";
import { loginSchema, registerSchema } from "@/lib/validations/auth";

describe("registerSchema", () => {
  const valid = { username: "dizi_sever", email: "Ali@Example.com ", password: "12345678" };

  it("accepts a valid form and normalises the e-mail", () => {
    const parsed = registerSchema.parse(valid);
    expect(parsed.email).toBe("ali@example.com");
  });

  it.each([
    ["too short", "ab"],
    ["too long", "a".repeat(21)],
    ["uppercase", "DiziSever"],
    ["spaces", "dizi sever"],
    ["Turkish letters", "dizişever"],
  ])("rejects a username that is %s", (_, username) => {
    expect(registerSchema.safeParse({ ...valid, username }).success).toBe(false);
  });

  it("rejects bad e-mails and short or overlong passwords", () => {
    expect(registerSchema.safeParse({ ...valid, email: "gecersiz" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, password: "1234567" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, password: "x".repeat(73) }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("requires both fields", () => {
    expect(loginSchema.safeParse({ identifier: "ali", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ identifier: "  ", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ identifier: "ali", password: "" }).success).toBe(false);
  });
});

describe("safeRedirect", () => {
  it("keeps paths on this site", () => {
    expect(safeRedirect("/series/335")).toBe("/series/335");
    expect(safeRedirect("/search?q=a")).toBe("/search?q=a");
  });

  it.each([undefined, null, "", "https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)"])(
    "falls back to / for %s",
    (path) => {
      expect(safeRedirect(path)).toBe("/");
    },
  );
});
