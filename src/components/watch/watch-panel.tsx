"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, Loader2, Lock, Pencil, Star, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { saveEpisodeWatch, unwatchEpisode } from "@/app/actions/watch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EmotionValue } from "@/lib/emotions";
import { NOTE_MAX_LENGTH } from "@/lib/validations/watch";
import { EmotionList, EmotionPicker } from "./emotion-picker";
import { usePreviousEpisodesPrompt } from "./previous-episodes-prompt";
import { RatingInput } from "./rating-input";
import { useLoginRedirect } from "./use-login-redirect";

export type SavedWatch = { rating: number | null; emotions: string[]; note: string | null };

/**
 * Episode page panel: "İzledim" → rating (1-10), emotions and a private note.
 * Once watched it shows the saved values with edit and undo.
 */
export function WatchPanel({
  episodeId,
  aired,
  signedIn,
  watch,
}: {
  episodeId: string;
  aired: boolean;
  signedIn: boolean;
  watch: SavedWatch | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const goToLogin = useLoginRedirect();
  const router = useRouter();
  const [offerPreviousEpisodes, previousPrompt] = usePreviousEpisodesPrompt();

  if (!aired) {
    return (
      <div className="bg-card text-muted-foreground rounded-2xl border p-5 text-sm">
        Bu bölüm henüz yayınlanmadı; yayınlandıktan sonra izledim olarak işaretleyebilirsin.
      </div>
    );
  }

  const openForm = () => (signedIn ? setOpen(true) : goToLogin());

  const unwatch = () =>
    startTransition(async () => {
      const result = await unwatchEpisode(episodeId);
      if (result.ok) {
        router.refresh();
        toast.success("İzlenmedi olarak işaretlendi.");
      } else toast.error(result.error);
    });

  return (
    <section aria-labelledby="watch-heading" className="bg-card space-y-4 rounded-2xl border p-5">
      {watch ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="watch-heading" className="inline-flex items-center gap-2 text-lg font-bold text-emerald-400">
              <Check className="size-5" />
              İzledin
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={openForm} disabled={pending}>
                <Pencil />
                Düzenle
              </Button>
              <Button variant="ghost" size="sm" onClick={unwatch} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Undo2 />}
                İzlenmedi olarak işaretle
              </Button>
            </div>
          </div>

          <dl className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <dt className="text-muted-foreground w-20 shrink-0">Puanın</dt>
              <dd className="inline-flex items-center gap-1 font-bold text-amber-400">
                {watch.rating != null ? (
                  <>
                    <Star className="size-4 fill-current" />
                    {watch.rating}/10
                  </>
                ) : (
                  <span className="text-muted-foreground font-normal">Puan vermedin</span>
                )}
              </dd>
            </div>
            <div className="flex items-start gap-2">
              <dt className="text-muted-foreground w-20 shrink-0 pt-1">Duygular</dt>
              <dd>
                {watch.emotions.length > 0 ? (
                  <EmotionList value={watch.emotions} />
                ) : (
                  <span className="text-muted-foreground">Seçmedin</span>
                )}
              </dd>
            </div>
            {watch.note && (
              <div className="flex items-start gap-2">
                <dt className="text-muted-foreground w-20 shrink-0">Notun</dt>
                <dd className="min-w-0 space-y-1">
                  <p className="break-words whitespace-pre-wrap">{watch.note}</p>
                  <p className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                    <Lock className="size-3" />
                    Sadece sen görürsün
                  </p>
                </dd>
              </div>
            )}
          </dl>
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="watch-heading" className="text-lg font-bold">
              Bu bölümü izledin mi?
            </h2>
            <p className="text-muted-foreground text-sm">Puan ver, hislerini ve kendine bir not bırak.</p>
          </div>
          <Button size="lg" onClick={openForm}>
            <Eye />
            İzledim
          </Button>
        </div>
      )}

      {signedIn && (
        <WatchDialog
          key={open ? "open" : "closed"}
          open={open}
          onOpenChange={setOpen}
          episodeId={episodeId}
          initial={watch}
          onSaved={(previousUnwatched) => offerPreviousEpisodes(episodeId, previousUnwatched)}
        />
      )}
      {previousPrompt}
    </section>
  );
}

function WatchDialog({
  open,
  onOpenChange,
  episodeId,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  episodeId: string;
  initial: SavedWatch | null;
  /** Called after a first save with the number of earlier unwatched episodes */
  onSaved: (previousUnwatched: number) => void;
}) {
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null);
  const [emotions, setEmotions] = useState<EmotionValue[]>((initial?.emotions ?? []) as EmotionValue[]);
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const save = () => {
    setError(undefined);
    startTransition(async () => {
      const result = await saveEpisodeWatch({ episodeId, rating, emotions, note });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
      router.refresh();
      toast.success(initial ? "Kaydın güncellendi." : "İzledin olarak kaydedildi.");
      if (!initial) onSaved(result.previousUnwatched);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Kaydını düzenle" : "İzledim"}</DialogTitle>
          <DialogDescription>Hepsi isteğe bağlı; sadece &ldquo;Kaydet&rdquo;e de basabilirsin.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label asChild>
              <span>Puanın</span>
            </Label>
            <RatingInput value={rating} onChange={setRating} />
          </div>
          <div className="space-y-2">
            <Label asChild>
              <span>Nasıl hissettirdi?</span>
            </Label>
            <EmotionPicker value={emotions} onChange={setEmotions} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="watch-note">Kişisel not</Label>
            <Textarea
              id="watch-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={NOTE_MAX_LENGTH}
              rows={3}
              placeholder="Sadece senin göreceğin bir not…"
            />
            <p className="text-muted-foreground text-right text-xs">
              {note.length}/{NOTE_MAX_LENGTH}
            </p>
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Vazgeç
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
