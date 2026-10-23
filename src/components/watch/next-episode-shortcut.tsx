"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Loader2, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { markEpisodeWatched } from "@/app/actions/watch";
import { Button } from "@/components/ui/button";
import { usePreviousEpisodesPrompt } from "./previous-episodes-prompt";
import { useLoginRedirect } from "./use-login-redirect";

/**
 * "Sonraki bölümü izledim": marks the next episode watched without leaving this page (and, as everywhere,
 * offers to mark earlier unwatched ones too). The toast links to the next episode to rate it.
 */
export function NextEpisodeShortcut({
  episodeId,
  code,
  name,
  href,
  watched,
  signedIn,
}: {
  episodeId: string;
  /** "S01E02" */
  code: string;
  name: string;
  href: string;
  watched: boolean;
  signedIn: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [isWatched, setWatched] = useOptimistic(watched);
  const [offerPreviousEpisodes, previousPrompt] = usePreviousEpisodesPrompt();
  const goToLogin = useLoginRedirect();
  const router = useRouter();

  const mark = () => {
    if (!signedIn) return goToLogin();
    startTransition(async () => {
      setWatched(true);
      const result = await markEpisodeWatched(episodeId);
      if (!result.ok) return void toast.error(result.error);
      router.refresh();
      toast.success(`${code} izlendi olarak işaretlendi.`, {
        action: { label: "Bölüme git", onClick: () => router.push(href) },
      });
      offerPreviousEpisodes(episodeId, result.previousUnwatched);
    });
  };

  return (
    <section
      aria-label="Sonraki bölüm"
      className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-3"
    >
      <Link href={href} className="group min-w-0 flex-1">
        <span className="text-muted-foreground block text-xs font-semibold">Sonraki bölüm · {code}</span>
        <span className="group-hover:text-primary flex items-center gap-1 truncate font-semibold">
          <span className="truncate">{name}</span>
          <ChevronRight className="size-4 shrink-0" />
        </span>
      </Link>
      {isWatched ? (
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
          <Check className="size-4" />
          İzlendi
        </span>
      ) : (
        <Button variant="outline" size="sm" onClick={mark} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <SkipForward />}
          Sonraki bölümü izledim
        </Button>
      )}
      {previousPrompt}
    </section>
  );
}
