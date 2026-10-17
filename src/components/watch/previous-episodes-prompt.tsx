"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { markPreviousEpisodesWatched } from "@/app/actions/watch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * After an episode is marked watched while earlier aired episodes are still unwatched, asks
 * "Önceki bölümleri de izlendi olarak işaretle?" (PROJE_PLANI.md §5).
 * Usage: `const [offer, prompt] = usePreviousEpisodesPrompt();` → call `offer(id, count)`, render `prompt`.
 */
export function usePreviousEpisodesPrompt() {
  const [state, setState] = useState<{ episodeId: string; count: number } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const offer = (episodeId: string, count: number) => {
    if (count > 0) setState({ episodeId, count });
  };

  const confirm = () => {
    if (!state) return;
    startTransition(async () => {
      const result = await markPreviousEpisodesWatched(state.episodeId);
      setState(null);
      if (result.ok) router.refresh();
      if (result.ok) toast.success(`${result.marked} bölüm izlendi olarak işaretlendi.`);
      else toast.error(result.error);
    });
  };

  const prompt = (
    <Dialog open={state !== null} onOpenChange={(open) => !open && !pending && setState(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Önceki {state?.count} bölümü de izledin mi?</DialogTitle>
          <DialogDescription>
            Bu bölümden önce yayınlanmış ve izlendi olarak işaretlenmemiş {state?.count} bölüm var. Hepsini izlendi
            olarak işaretleyelim mi?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setState(null)} disabled={pending}>
            Hayır, sadece bu bölüm
          </Button>
          <Button onClick={confirm} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Evet, hepsini işaretle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return [offer, prompt] as const;
}
