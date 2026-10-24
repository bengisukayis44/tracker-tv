"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { idSchema } from "@/lib/validations/watch";
import type { ActionResult } from "./watch";

const NOT_ALLOWED = { ok: false, error: "Bu işlem için yetkin yok." } as const;
const USER_NOT_FOUND = { ok: false, error: "Kullanıcı bulunamadı." } as const;

/** Every admin action checks again on the server: a hidden button is not a permission. */
async function adminOnly() {
  const user = await getCurrentUser();
  return user?.isAdmin ? user : null;
}

/** Someone the admin may act on: not themselves and not another admin. */
async function actionableUser(adminId: string, userId: string) {
  if (!idSchema.safeParse(userId).success || userId === adminId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isAdmin: true } });
  return user && !user.isAdmin ? user : null;
}

/**
 * Suspends or restores an account. A suspended account is banned in Supabase Auth (cannot sign in, sessions end)
 * and counts as signed out in the app.
 */
export async function setSuspended(userId: string, suspended: boolean): Promise<ActionResult> {
  const admin = await adminOnly();
  if (!admin) return NOT_ALLOWED;
  const user = await actionableUser(admin.id, userId);
  if (!user) return USER_NOT_FOUND;

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { suspendedAt: suspended ? new Date() : null } }),
    suspended
      ? prisma.$executeRaw`UPDATE auth.users SET banned_until = '2999-01-01' WHERE id = ${userId}::uuid`
      : prisma.$executeRaw`UPDATE auth.users SET banned_until = NULL WHERE id = ${userId}::uuid`,
    ...(suspended ? [prisma.$executeRaw`DELETE FROM auth.sessions WHERE user_id = ${userId}::uuid`] : []),
  ]);
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/** Deletes an account for good; the database removes its profile and everything it made with it. */
export async function deleteUserAccount(userId: string): Promise<ActionResult> {
  const admin = await adminOnly();
  if (!admin) return NOT_ALLOWED;
  const user = await actionableUser(admin.id, userId);
  if (!user) return USER_NOT_FOUND;

  // The on_auth_user_deleted trigger deletes the "User" row, which cascades to the rest
  await prisma.$executeRaw`DELETE FROM auth.users WHERE id = ${userId}::uuid`;
  await prisma.user.deleteMany({ where: { id: userId } });
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/** Removes a comment (and its replies) from wherever it is. */
export async function adminDeleteComment(commentId: string): Promise<ActionResult> {
  if (!(await adminOnly())) return NOT_ALLOWED;
  if (!idSchema.safeParse(commentId).success) return { ok: false, error: "Yorum bulunamadı." };
  await prisma.comment.deleteMany({ where: { id: commentId } });
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/** "Sorun yok": closes the open reports on a comment; new reports open it again. */
export async function dismissReports(commentId: string): Promise<ActionResult> {
  if (!(await adminOnly())) return NOT_ALLOWED;
  if (!idSchema.safeParse(commentId).success) return { ok: false, error: "Yorum bulunamadı." };
  await prisma.commentReport.updateMany({ where: { commentId, resolvedAt: null }, data: { resolvedAt: new Date() } });
  revalidatePath("/admin", "layout");
  return { ok: true };
}
