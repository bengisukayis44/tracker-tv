import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { AVATAR_MAX_UPLOAD_BYTES, AvatarError, processAvatar } from "@/lib/avatar";

const photo = async (width: number, height: number) =>
  new File(
    [
      await sharp({ create: { width, height, channels: 3, background: "#123456" } })
        .png()
        .toBuffer(),
    ],
    "a.png",
    {
      type: "image/png",
    },
  );

describe("processAvatar", () => {
  it("turns any photo into a 256×256 WebP", async () => {
    const meta = await sharp(await processAvatar(await photo(800, 300))).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 256, 256]);
  });

  it("refuses other file types, oversized uploads and unreadable files", async () => {
    await expect(processAvatar(new File(["GIF89a"], "a.gif", { type: "image/gif" }))).rejects.toBeInstanceOf(
      AvatarError,
    );
    const big = new File([new Uint8Array(AVATAR_MAX_UPLOAD_BYTES + 1)], "a.jpg", { type: "image/jpeg" });
    await expect(processAvatar(big)).rejects.toThrow("Fotoğraf çok büyük.");
    await expect(processAvatar(new File(["bozuk"], "a.jpg", { type: "image/jpeg" }))).rejects.toThrow("okunamadı");
  });
});
