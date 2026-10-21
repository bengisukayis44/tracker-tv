"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { toggleWatchlist } from "@/app/actions/watch";
import { Button } from "@/components/ui/button";

/** "Kaldır" under a "Daha sonra izle" card. */
export function WatchlistRemoveButton({ titleId, name }: { titleId: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const remove = () =>
    startTransition(async () => {
      const result = await toggleWatchlist(titleId);
      if (!result.ok) return void toast.error(result.error);
      router.refresh();
      toast.success(`${name} listenden çıkarıldı.`);
    });

  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full"
      onClick={remove}
      disabled={pending}
      aria-label={`${name}: listeden kaldır`}
    >
      {pending ? <Loader2 className="animate-spin" /> : <X />}
      Kaldır
    </Button>
  );
}
