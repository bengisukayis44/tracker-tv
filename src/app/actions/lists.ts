"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listFieldsSchema, MAX_LIST_ITEMS, MAX_LISTS, type ListFields } from "@/lib/validations/list";
import { idSchema } from "@/lib/validations/watch";
import type { ActionResult } from "./watch";

const LOGIN_REQUIRED = { ok: false, error: "Bunun için giriş yapmalısın.", needsLogin: true } as const;
const LIST_NOT_FOUND = { ok: false, error: "Liste bulunamadı." } as const;

function revalidateLists(username: string, listId?: string) {
  revalidatePath(`/profile/${username}`);
  if (listId) revalidatePath(`/list/${listId}`);
}

/** The user's own list, or null (someone else's list counts as not found). */
async function ownList(userId: string, listId: string) {
  if (!idSchema.safeParse(listId).success) return null;
  return prisma.list.findFirst({ where: { id: listId, userId }, select: { id: true } });
}

export type ListChoice = { id: string; name: string; isPublic: boolean; contains: boolean; count: number };

/** The user's lists for the "Listeye ekle" window, each saying whether it already holds the title. */
export async function getListChoices(titleId: string): Promise<ActionResult<{ lists: ListChoice[] }>> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;
  const lists = await prisma.list.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      isPublic: true,
      _count: { select: { items: true } },
      items: { where: { titleId }, select: { titleId: true } },
    },
  });
  return {
    ok: true,
    lists: lists.map((l) => ({
      id: l.id,
      name: l.name,
      isPublic: l.isPublic,
      contains: l.items.length > 0,
      count: l._count.items,
    })),
  };
}

/** Creates a list, optionally with a first title in it. */
export async function createList(input: ListFields & { titleId?: string }): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;
  const parsed = listFieldsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz bilgi." };
  if ((await prisma.list.count({ where: { userId: user.id } })) >= MAX_LISTS) {
    return { ok: false, error: `En fazla ${MAX_LISTS} liste oluşturabilirsin.` };
  }
  const title =
    input.titleId && idSchema.safeParse(input.titleId).success
      ? await prisma.title.findUnique({ where: { id: input.titleId }, select: { id: true } })
      : null;
  const list = await prisma.list.create({
    data: { userId: user.id, ...parsed.data, ...(title ? { items: { create: { titleId: title.id } } } : {}) },
    select: { id: true },
  });
  revalidateLists(user.username, list.id);
  return { ok: true, id: list.id };
}

/** Puts a title in a list or takes it out. */
export async function setListMembership(listId: string, titleId: string, inList: boolean): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;
  const list = await ownList(user.id, listId);
  if (!list || !idSchema.safeParse(titleId).success) return LIST_NOT_FOUND;
  if (inList) {
    const title = await prisma.title.findUnique({ where: { id: titleId }, select: { id: true } });
    if (!title) return { ok: false, error: "İçerik bulunamadı." };
    if ((await prisma.listItem.count({ where: { listId } })) >= MAX_LIST_ITEMS) {
      return { ok: false, error: `Bir listede en fazla ${MAX_LIST_ITEMS} yapım olabilir.` };
    }
    await prisma.listItem.createMany({ data: [{ listId, titleId }], skipDuplicates: true });
  } else {
    await prisma.listItem.deleteMany({ where: { listId, titleId } });
  }
  // The list moves to the top of "Listelerim"
  await prisma.list.update({ where: { id: listId }, data: { updatedAt: new Date() } });
  revalidateLists(user.username, listId);
  return { ok: true };
}

export async function updateList(listId: string, input: ListFields): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;
  if (!(await ownList(user.id, listId))) return LIST_NOT_FOUND;
  const parsed = listFieldsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz bilgi." };
  await prisma.list.update({ where: { id: listId }, data: parsed.data });
  revalidateLists(user.username, listId);
  return { ok: true };
}

export async function deleteList(listId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;
  if (!(await ownList(user.id, listId))) return LIST_NOT_FOUND;
  await prisma.list.delete({ where: { id: listId } });
  revalidateLists(user.username, listId);
  return { ok: true };
}
