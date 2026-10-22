"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, Loader2, Lock, Pencil, Repeat, Star, Undo2 } from "lucide-react";
import { toast } from "sonner";
import {
  addRewatch,
  saveEpisodeWatch,
  saveMovieWatch,
  undoRewatch,
  unwatchEpisode,
  unwatchMovie,
} from "@/app/actions/watch";
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
import type { CastMember } from "@/lib/cast";
import type { EmotionValue } from "@/lib/emotions";
import { formatDate } from "@/lib/format";
import { NOTE_MAX_LENGTH } from "@/lib/validations/watch";
import { EmotionList, EmotionPicker } from "./emotion-picker";
import { CastAvatar, CharacterPicker } from "./character-picker";
import { usePreviousEpisodesPrompt } from "./previous-episodes-prompt";
import { RatingInput } from "./rating-input";
import { useLoginRedirect } from "./use-login-redirect";

export type SavedWatch = {
  rating: number | null;
  emotions: string[];
  note: string | null;
  favoriteCastId: number | null;
  favoriteCharacter: string | null;
  watchedAt: Date;
  /** Dates of every watch after the first */
  rewatchedAt: Date[];
};

/** What is being marked: an episode (offers to mark earlier ones too) or a movie. */
export type WatchTarget = { kind: "episode"; episodeId: string } | { kind: "movie"; titleId: string };

/**
 * Episode and movie page panel: "İzledim" → rating (1-10), emotions and a private note.
 * Once watched it shows the saved values with edit and undo.
 */
export function WatchPanel({
  target,
  aired,
  signedIn,
  watch,
  cast,
}: {
  target: WatchTarget;
  /** Episode aired / movie released */
  aired: boolean;
  signedIn: boolean;
  watch: SavedWatch | null;
  /** The series' or movie's cast, for "Favori karakterin" */
  cast: CastMember[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const goToLogin = useLoginRedirect();
  const router = useRouter();
  const [offerPreviousEpisodes, previousPrompt] = usePreviousEpisodesPrompt();

  if (!aired) {
    return (
      <div className="bg-card text-muted-foreground rounded-2xl border p-5 text-sm">
        {target.kind === "movie"
          ? "Bu film henüz vizyona girmedi; çıktıktan sonra izledim olarak işaretleyebilirsin."
          : "Bu bölüm henüz yayınlanmadı; yayınlandıktan sonra izledim olarak işaretleyebilirsin."}
      </div>
    );
  }

  const openForm = () => (signedIn ? setOpen(true) : goToLogin());
  const favoriteMember = cast.find((m) => m.id === watch?.favoriteCastId);

  const unwatch = () =>
    startTransition(async () => {
      const result =
        target.kind === "movie" ? await unwatchMovie(target.titleId) : await unwatchEpisode(target.episodeId);
      if (result.ok) {
        router.refresh();
        toast.success("İzlenmedi olarak işaretlendi.");
      } else toast.error(result.error);
    });

  const rewatch = (undo: boolean) =>
    startTransition(async () => {
      const result = undo ? await undoRewatch(target) : await addRewatch(target);
      if (!result.ok) return void toast.error(result.error);
      router.refresh();
      toast.success(undo ? "Son tekrar geri alındı." : `${result.watchCount}. kez izledin olarak kaydedildi.`);
    });

  const lastRewatch = watch?.rewatchedAt.at(-1);

  return (
    <section aria-labelledby="watch-heading" className="bg-card space-y-4 rounded-2xl border p-5">
      {watch ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="watch-heading" className="inline-flex items-center gap-2 text-lg font-bold text-emerald-400">
                <Check className="size-5" />
                İzledin
              </h2>
              <p className="text-muted-foreground text-sm">
                İzlenme tarihi:{" "}
                <time dateTime={new Date(watch.watchedAt).toISOString()}>{formatDate(watch.watchedAt)}</time>
              </p>
              {lastRewatch && (
                <p className="text-muted-foreground text-sm">
                  <span className="text-foreground font-semibold">{1 + watch.rewatchedAt.length} kez izledin</span>
                  {" · son: "}
                  <time dateTime={new Date(lastRewatch).toISOString()}>{formatDate(lastRewatch)}</time>
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={openForm} disabled={pending}>
                <Pencil />
                Düzenle
              </Button>
              <Button variant="outline" size="sm" onClick={() => rewatch(false)} disabled={pending}>
                <Repeat />
                Tekrar izledim
              </Button>
              {lastRewatch && (
                <Button variant="ghost" size="sm" onClick={() => rewatch(true)} disabled={pending}>
                  <Undo2 />
                  Son tekrarı geri al
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={unwatch} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Undo2 />}
                İzlenmedi olarak işaretle
              </Button>
            </div>
          </div>

          <dl className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <dt className="text-muted-foreground w-28 shrink-0">Puanın</dt>
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
              <dt className="text-muted-foreground w-28 shrink-0 pt-1">Duygular</dt>
              <dd>
                {watch.emotions.length > 0 ? (
                  <EmotionList value={watch.emotions} />
                ) : (
                  <span className="text-muted-foreground">Seçmedin</span>
                )}
              </dd>
            </div>
            {watch.favoriteCharacter && (
              <div className="flex items-center gap-2">
                <dt className="text-muted-foreground w-28 shrink-0">Favori karakter</dt>
                <dd className="flex min-w-0 items-center gap-2">
                  <CastAvatar member={favoriteMember} className="size-8" />
                  <span className="min-w-0">
                    <span className="block font-semibold">{watch.favoriteCharacter}</span>
                    {favoriteMember && (
                      <span className="text-muted-foreground block text-xs">{favoriteMember.name}</span>
                    )}
                  </span>
                </dd>
              </div>
            )}
            {watch.note && (
              <div className="flex items-start gap-2">
                <dt className="text-muted-foreground w-28 shrink-0">Notun</dt>
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
              {target.kind === "movie" ? "Bu filmi izledin mi?" : "Bu bölümü izledin mi?"}
            </h2>
            <p className="text-muted-foreground text-sm">
              Puan ver, hislerini{cast.length > 0 && ", favori karakterini"} ve kendine bir not bırak.
            </p>
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
          target={target}
          initial={watch}
          cast={cast}
          onSaved={(previousUnwatched) => {
            if (target.kind === "episode") offerPreviousEpisodes(target.episodeId, previousUnwatched);
          }}
        />
      )}
      {previousPrompt}
    </section>
  );
}

function WatchDialog({
  open,
  onOpenChange,
  target,
  initial,
  cast,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: WatchTarget;
  initial: SavedWatch | null;
  cast: CastMember[];
  /** Called after a first save with the number of earlier unwatched episodes */
  onSaved: (previousUnwatched: number) => void;
}) {
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null);
  const [emotions, setEmotions] = useState<EmotionValue[]>((initial?.emotions ?? []) as EmotionValue[]);
  const [note, setNote] = useState(initial?.note ?? "");
  // Someone who has since left the cast cannot be shown in the picker, so they are not kept
  const [favoriteCastId, setFavoriteCastId] = useState<number | null>(
    cast.some((m) => m.id === initial?.favoriteCastId) ? initial!.favoriteCastId : null,
  );
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const save = () => {
    setError(undefined);
    startTransition(async () => {
      const fields = { rating, emotions, note, favoriteCastId };
      const result =
        target.kind === "movie"
          ? await saveMovieWatch({ titleId: target.titleId, ...fields })
          : await saveEpisodeWatch({ episodeId: target.episodeId, ...fields });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
      router.refresh();
      toast.success(initial ? "Kaydın güncellendi." : "İzledin olarak kaydedildi.");
      if (!initial && "previousUnwatched" in result) onSaved(result.previousUnwatched as number);
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
          {cast.length > 0 && (
            <div className="space-y-2">
              <Label asChild>
                <span>Favori karakterin</span>
              </Label>
              <CharacterPicker cast={cast} value={favoriteCastId} onChange={setFavoriteCastId} />
            </div>
          )}
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
