import "server-only";
import sharp from "sharp";

/** Uploaded photos are cut to a square of this size. */
export const AVATAR_SIZE = 256;
// The browser already shrinks photos before sending; this only stops oversized uploads
export const AVATAR_MAX_UPLOAD_BYTES = 900 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export class AvatarError extends Error {}

/** Checks an uploaded photo and turns it into a small square WebP (also drops metadata such as GPS). */
export async function processAvatar(file: File): Promise<Buffer> {
  if (!ACCEPTED_TYPES.has(file.type)) throw new AvatarError("JPEG, PNG ya da WebP bir fotoğraf seç.");
  if (file.size > AVATAR_MAX_UPLOAD_BYTES) throw new AvatarError("Fotoğraf çok büyük.");
  try {
    return await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate() // honour the phone's orientation flag before it is stripped
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new AvatarError("Bu dosya okunamadı. Başka bir fotoğraf dene.");
  }
}
