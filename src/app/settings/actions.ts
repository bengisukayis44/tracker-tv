"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/watch";
import { getCurrentUser } from "@/lib/auth";
import { AvatarError, processAvatar } from "@/lib/avatar";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { usernameSchema } from "@/lib/validations/auth";

const LOGIN_REQUIRED = { ok: false, error: "Bunun için giriş yapmalısın.", needsLogin: true } as const;
const BUCKET = "avatars";

/** Pages that show the user's name or photo. */
function revalidateUser(username: string) {
  revalidatePath("/", "layout");
  revalidatePath(`/profile/${username}`);
}

export async function changeUsername(input: string): Promise<ActionResult<{ username: string }>> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;

  const parsed = usernameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz kullanıcı adı." };
  const username = parsed.data;
  if (username === user.username) return { ok: true, username };

  const taken = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (taken) return { ok: false, error: "Bu kullanıcı adı alınmış." };
  try {
    await prisma.user.update({ where: { id: user.id }, data: { username } });
  } catch {
    // Someone took it a moment ago (unique index)
    return { ok: false, error: "Bu kullanıcı adı alınmış." };
  }
  revalidateUser(user.username);
  return { ok: true, username };
}

export async function setProfilePrivate(isPrivate: boolean): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;
  await prisma.user.update({ where: { id: user.id }, data: { isPrivate: Boolean(isPrivate) } });
  revalidateUser(user.username);
  return { ok: true };
}

/** Removes every photo in the user's folder except `keep`. Storage rules only let them touch their own folder. */
async function removeOldAvatars(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, keep?: string) {
  const { data } = await supabase.storage.from(BUCKET).list(userId);
  const old = (data ?? []).map((f) => `${userId}/${f.name}`).filter((path) => path !== keep);
  if (old.length) await supabase.storage.from(BUCKET).remove(old);
}

export async function uploadAvatar(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Bir fotoğraf seç." };

  let image: Buffer;
  try {
    image = await processAvatar(file);
  } catch (error) {
    if (error instanceof AvatarError) return { ok: false, error: error.message };
    throw error;
  }

  // A new name each time, so browsers and CDNs never show the old photo from cache
  const path = `${user.id}/${Date.now()}.webp`;
  const supabase = await createClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, image, { contentType: "image/webp" });
  if (error) {
    console.error("Profil fotoğrafı yüklenemedi:", error);
    return { ok: false, error: "Fotoğraf yüklenemedi. Biraz sonra tekrar dene." };
  }
  const avatarUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl } });
  await removeOldAvatars(supabase, user.id, path);
  revalidateUser(user.username);
  return { ok: true };
}

export async function removeAvatar(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;
  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: null } });
  await removeOldAvatars(await createClient(), user.id);
  revalidateUser(user.username);
  return { ok: true };
}
