"use client";

import { startTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  // reset() alone only re-renders what is already there; refresh fetches the page from the server again
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });

  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <AlertCircle className="text-destructive mx-auto size-12" />
      <h1 className="text-2xl font-bold">Bir şeyler ters gitti</h1>
      <p className="text-muted-foreground">
        İçerik şu anda yüklenemedi. Veri kaynağına ulaşılamıyor olabilir; biraz sonra tekrar dene.
      </p>
      <div className="flex justify-center gap-2">
        <Button onClick={retry}>Tekrar dene</Button>
        <Button asChild variant="outline">
          <Link href="/">Ana sayfa</Link>
        </Button>
      </div>
    </div>
  );
}
