"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const RETRY_EVERY_MS = 5_000;
const MAX_AUTO_RETRIES = 12;

/** Shown while a series or movie nobody has opened yet is fetched in the background; reloads itself until ready. */
export function TitlePreparing({ kind = "series" }: { kind?: "series" | "movie" }) {
  const router = useRouter();
  const [tries, setTries] = useState(0);
  const gaveUp = tries >= MAX_AUTO_RETRIES;

  useEffect(() => {
    if (gaveUp) return;
    const timer = setTimeout(() => {
      setTries((n) => n + 1);
      router.refresh();
    }, RETRY_EVERY_MS);
    return () => clearTimeout(timer);
  }, [tries, gaveUp, router]);

  return (
    <div role="status" className="bg-card mx-auto max-w-md space-y-4 rounded-2xl border p-10 text-center">
      {!gaveUp && <Loader2 className="text-primary mx-auto size-10 animate-spin" />}
      <h1 className="text-xl font-bold">{kind === "movie" ? "Film hazırlanıyor" : "Dizi hazırlanıyor"}</h1>
      <p className="text-muted-foreground text-sm">
        {gaveUp
          ? "Veri kaynağı hâlâ yanıt vermiyor. Biraz sonra tekrar dene."
          : `Bu ${kind === "movie" ? "filmi" : "diziyi"} ilk kez açan sensin; bilgileri veri kaynağından çekiyoruz. Sayfa hazır olunca kendiliğinden açılacak.`}
      </p>
      {gaveUp && <Button onClick={() => setTries(0)}>Tekrar dene</Button>}
    </div>
  );
}
