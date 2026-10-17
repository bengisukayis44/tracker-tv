"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <AlertCircle className="text-destructive mx-auto size-12" />
      <h1 className="text-2xl font-bold">Bir şeyler ters gitti</h1>
      <p className="text-muted-foreground">
        İçerik şu anda yüklenemedi. Veri kaynağına ulaşılamıyor olabilir; biraz sonra tekrar dene.
      </p>
      <Button onClick={reset}>Tekrar dene</Button>
    </div>
  );
}
