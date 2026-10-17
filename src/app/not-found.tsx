import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <SearchX className="text-muted-foreground mx-auto size-12" />
      <h1 className="text-2xl font-bold">Sayfa bulunamadı</h1>
      <p className="text-muted-foreground">Aradığın dizi, bölüm ya da sayfa mevcut değil.</p>
      <Button asChild>
        <Link href="/search">Dizi ara</Link>
      </Button>
    </div>
  );
}
