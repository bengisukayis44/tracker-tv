"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { markEpisodeWatched, unwatchEpisode } from "@/app/actions/watch";
import { cn } from "@/lib/utils";
import { usePreviousEpisodesPrompt } from "./previous-episodes-prompt";
import { useLoginRedirect } from "./use-login-redirect";

/** Round check button on an episode row: marks watched / unwatched in one click. */
export function WatchToggle({
  episodeId,
  label,
  watched,
  aired,
  signedIn,
}: {
  episodeId: string;
  label: string;
  watched: boolean;
  aired: boolean;
  signedIn: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [optimisticWatched, setOptimisticWatched] = useOptimistic(watched);
  const goToLogin = useLoginRedirect();
  const router = useRouter();
  const [offerPreviousEpisodes, previousPrompt] = usePreviousEpisodesPrompt();

  const toggle = () => {
    if (!signedIn) return goToLogin();
    startTransition(async () => {
      setOptimisticWatched(!watched);
      if (watched) {
        const result = await unwatchEpisode(episodeId);
        if (!result.ok) toast.error(result.error);
        else router.refresh();
      } else {
        const result = await markEpisodeWatched(episodeId);
        if (!result.ok) toast.error(result.error);
        else {
          router.refresh();
          offerPreviousEpisodes(episodeId, result.previousUnwatched);
        }
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={!aired || pending}
        aria-pressed={optimisticWatched}
        aria-label={`${label}: ${optimisticWatched ? "izlendi, işareti kaldır" : "izledim olarak işaretle"}`}
        title={!aired ? "Henüz yayınlanmadı" : optimisticWatched ? "İzlendi" : "İzledim olarak işaretle"}
        className={cn(
          "focus-visible:ring-ring flex size-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40",
          optimisticWatched
            ? "border-emerald-500 bg-emerald-500 text-black"
            : "text-muted-foreground hover:border-emerald-500 hover:text-emerald-400",
        )}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" strokeWidth={3} />}
      </button>
      {previousPrompt}
    </>
  );
}
