"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { setSeasonWatched } from "@/app/actions/watch";
import { Button } from "@/components/ui/button";
import { useLoginRedirect } from "./use-login-redirect";

/** "Sezonun tamamını izledim" (aired episodes) and its undo. */
export function SeasonWatchButton({
  seasonId,
  seasonWatched,
  hasAired,
  signedIn,
}: {
  seasonId: string;
  seasonWatched: boolean;
  hasAired: boolean;
  signedIn: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const goToLogin = useLoginRedirect();
  const router = useRouter();
  if (!hasAired) return null;

  const run = () => {
    if (!signedIn) return goToLogin();
    startTransition(async () => {
      const result = await setSeasonWatched(seasonId, !seasonWatched);
      if (result.ok) router.refresh();
      if (!result.ok) toast.error(result.error);
      else if (seasonWatched) toast.success("Sezonun izleme işaretleri kaldırıldı.");
      else toast.success(`${result.changed} bölüm izlendi olarak işaretlendi.`);
    });
  };

  return (
    <Button variant="outline" size="sm" onClick={run} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : seasonWatched ? <Undo2 /> : <CheckCheck />}
      {seasonWatched ? "Sezon işaretini kaldır" : "Sezonun tamamını izledim"}
    </Button>
  );
}
