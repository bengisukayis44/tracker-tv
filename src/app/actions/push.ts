"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPushEnabled, pushToUser } from "@/lib/push";
import type { ActionResult } from "./watch";

const LOGIN_REQUIRED = { ok: false, error: "Bunun için giriş yapmalısın.", needsLogin: true } as const;

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** Stores this browser's push subscription for the signed-in user (moving it over if it belonged to another). */
export async function savePushSubscription(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;
  if (!isPushEnabled()) return { ok: false, error: "Bildirimler şu an kullanılamıyor." };
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Bu tarayıcının bildirim bilgisi okunamadı." };
  const { endpoint, keys } = parsed.data;
  const data = { userId: user.id, p256dh: keys.p256dh, auth: keys.auth };
  await prisma.pushSubscription.upsert({ where: { endpoint }, create: { endpoint, ...data }, update: data });
  return { ok: true };
}

export async function deletePushSubscription(endpoint: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;
  await prisma.pushSubscription.deleteMany({ where: { endpoint: String(endpoint), userId: user.id } });
  return { ok: true };
}

/** "Deneme bildirimi gönder": checks the whole chain on the user's own browsers. */
export async function sendTestPush(): Promise<ActionResult<{ delivered: number }>> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;
  const delivered = await pushToUser(user.id, [
    {
      title: "Tracker.tv",
      body: "Bildirimler açık. Takip ettiğin dizilerin yeni bölümü çıkınca haber vereceğiz.",
      url: "/watchlist",
      tag: "deneme",
    },
  ]);
  if (delivered === 0) return { ok: false, error: "Bildirim gönderilemedi. Bildirimleri kapatıp yeniden aç." };
  return { ok: true, delivered };
}
