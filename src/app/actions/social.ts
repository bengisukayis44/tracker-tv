"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { notify, unnotify } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { idSchema } from "@/lib/validations/watch";
import type { ActionResult } from "./watch";

const LOGIN_REQUIRED = { ok: false, error: "Bunun için giriş yapmalısın.", needsLogin: true } as const;
const USER_NOT_FOUND = { ok: false, error: "Kullanıcı bulunamadı." } as const;

/** Follows or unfollows another user. Private profiles cannot be followed. */
export async function setFollowing(userId: string, follow: boolean): Promise<ActionResult<{ following: boolean }>> {
  const me = await getCurrentUser();
  if (!me) return LOGIN_REQUIRED;
  if (!idSchema.safeParse(userId).success) return USER_NOT_FOUND;
  if (userId === me.id) return { ok: false, error: "Kendini takip edemezsin." };

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { username: true, isPrivate: true } });
  if (!target) return USER_NOT_FOUND;

  const key = { followerId: me.id, followingId: userId };
  if (follow) {
    if (target.isPrivate) return { ok: false, error: "Gizli profiller takip edilemez." };
    await prisma.follow.createMany({ data: [key], skipDuplicates: true });
    await notify(userId, me.id, "FOLLOW");
  } else {
    await prisma.follow.deleteMany({ where: key });
    await unnotify(userId, me.id, "FOLLOW");
  }
  revalidatePath(`/profile/${target.username}`);
  revalidatePath("/akis");
  return { ok: true, following: follow };
}
