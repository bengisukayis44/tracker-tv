"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { deletePushSubscription, savePushSubscription, sendTestPush } from "@/app/actions/push";
import { Button } from "@/components/ui/button";

type State = "loading" | "unsupported" | "denied" | "off" | "on";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** The public key as the bytes PushManager.subscribe expects. */
function keyBytes(base64Url: string) {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

const supported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window &&
  Boolean(VAPID_PUBLIC_KEY);

/** Some browsers never answer the subscription request; give up instead of spinning forever. */
function withTimeout<T>(promise: Promise<T>, ms = 20_000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Bildirim aboneliği zaman aşımına uğradı")), ms)),
  ]);
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** Turns new-episode notifications on or off for this browser. */
export function NotificationForm() {
  const [state, setState] = useState<State>("loading");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!supported()) return setState("unsupported");
    if (Notification.permission === "denied") return setState("denied");
    currentSubscription().then((sub) => setState(sub ? "on" : "off"), () => setState("off"));
  }, []);

  const enable = () =>
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
        await navigator.serviceWorker.register("/sw.js");
        const registration = await withTimeout(navigator.serviceWorker.ready);
        const subscription =
          (await registration.pushManager.getSubscription()) ??
          (await withTimeout(
            registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: keyBytes(VAPID_PUBLIC_KEY!),
            }),
          ));
        const result = await savePushSubscription(subscription.toJSON());
        if (!result.ok) {
          await subscription.unsubscribe();
          return void toast.error(result.error);
        }
        setState("on");
        toast.success("Bildirimler açıldı.");
      } catch (error) {
        console.error(error);
        toast.error("Bu tarayıcıda bildirimler açılamadı.");
      }
    });

  const disable = () =>
    startTransition(async () => {
      const subscription = await currentSubscription();
      if (subscription) {
        await deletePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState("off");
      toast.success("Bildirimler kapatıldı.");
    });

  const test = () =>
    startTransition(async () => {
      const result = await sendTestPush();
      if (!result.ok) toast.error(result.error);
      else toast.success("Deneme bildirimi gönderildi.");
    });

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        Takip ettiğin (izlediğin ya da listene eklediğin) dizilerin yeni bölümü yayınlandığı gün, sabah bu tarayıcıya
        bildirim gelir. Her cihazda ayrı açılır.
      </p>
      {state === "loading" ? (
        <Loader2 className="text-muted-foreground size-5 animate-spin" />
      ) : state === "unsupported" ? (
        <p className="text-sm">
          Bu tarayıcı bildirimleri desteklemiyor. iPhone ve iPad&apos;de bildirimler yalnızca site ana ekrana
          eklendiğinde çalışır.
        </p>
      ) : state === "denied" ? (
        <p className="text-sm">
          Bu sitenin bildirimlerini tarayıcı ayarlarından engellemişsin. Açmak için tarayıcının site ayarlarından
          bildirimlere izin ver, sonra sayfayı yenile.
        </p>
      ) : state === "on" ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
            <Bell className="size-4" />
            Bu tarayıcıda açık
          </span>
          <Button variant="outline" size="sm" onClick={test} disabled={pending}>
            <Send />
            Deneme bildirimi gönder
          </Button>
          <Button variant="ghost" size="sm" onClick={disable} disabled={pending}>
            <BellOff />
            Kapat
          </Button>
        </div>
      ) : (
        <Button onClick={enable} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Bell />}
          Bildirimleri aç
        </Button>
      )}
    </div>
  );
}
