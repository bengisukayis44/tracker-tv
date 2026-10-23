"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2, Trash2, UserRound, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import {
  getCharacterChoices,
  getCharacterTitles,
  removeCoverCharacter,
  setCoverCharacter,
  type CoverTitle,
} from "@/app/actions/cover";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { characterLabel, type CastMember } from "@/lib/cast";
import { cn } from "@/lib/utils";

type Step =
  { kind: "titles"; titles: CoverTitle[] | null } | { kind: "cast"; title: CoverTitle; cast: CastMember[] | null };

/** "Karakter seç": a series or movie from your lists, then one of its characters, for the cover's second page. */
export function CoverCharacterPicker({ hasCharacter, className }: { hasCharacter: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>({ kind: "titles", titles: null });
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const showTitles = () => {
    setError(undefined);
    setStep({ kind: "titles", titles: null });
    startTransition(async () => {
      const result = await getCharacterTitles();
      if (!result.ok) return setError(result.error);
      setStep({ kind: "titles", titles: result.titles });
    });
  };

  const showCast = (title: CoverTitle) => {
    setError(undefined);
    setStep({ kind: "cast", title, cast: null });
    startTransition(async () => {
      const result = await getCharacterChoices({ type: title.type, tmdbId: title.tmdbId });
      if (!result.ok) return setError(result.error);
      setStep({ kind: "cast", title, cast: result.cast });
    });
  };

  const choose = (title: CoverTitle, member: CastMember) =>
    startTransition(async () => {
      const result = await setCoverCharacter({ type: title.type, tmdbId: title.tmdbId, castId: member.id });
      if (!result.ok) return setError(result.error);
      setOpen(false);
      router.refresh();
      toast.success(`${characterLabel(member)} kapağına eklendi.`);
    });

  const remove = () =>
    startTransition(async () => {
      const result = await removeCoverCharacter();
      if (!result.ok) return void toast.error(result.error);
      router.refresh();
      toast.success("Kapaktaki karakter kaldırıldı.");
    });

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setOpen(true);
          showTitles();
        }}
      >
        <UserRoundPlus />
        {hasCharacter ? "Karakteri değiştir" : "Karakter seç"}
      </Button>
      {hasCharacter && (
        <Button variant="secondary" size="sm" onClick={remove} disabled={pending} aria-label="Karakteri kaldır">
          <Trash2 />
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{step.kind === "titles" ? "Hangi diziden ya da filmden?" : step.title.name}</DialogTitle>
            <DialogDescription>
              {step.kind === "titles"
                ? "İzlediğin ve listendeki diziler ve filmler."
                : "Kapağında görünecek karakteri seç."}
            </DialogDescription>
          </DialogHeader>

          {step.kind === "cast" && (
            <Button variant="ghost" size="sm" className="w-fit" onClick={showTitles} disabled={pending}>
              <ChevronLeft />
              Başka bir dizi ya da film
            </Button>
          )}

          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : step.kind === "titles" ? (
            step.titles === null ? (
              <Loading />
            ) : step.titles.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Listende henüz dizi ya da film yok. Bir şey izledikçe ya da &ldquo;Daha sonra izle&rdquo;ye ekledikçe
                burada görünür.
              </p>
            ) : (
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {step.titles.map((title) => (
                  <li key={`${title.type}-${title.tmdbId}`}>
                    <button type="button" onClick={() => showCast(title)} className="group w-full space-y-1 text-left">
                      <span className="bg-muted relative block aspect-[2/3] overflow-hidden rounded-lg border">
                        {title.posterUrl && (
                          <Image src={title.posterUrl} alt="" fill sizes="140px" className="object-cover" />
                        )}
                      </span>
                      <span className="group-hover:text-primary line-clamp-2 text-xs font-semibold">{title.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : step.cast === null ? (
            <Loading />
          ) : step.cast.length === 0 ? (
            <p className="text-muted-foreground text-sm">Bu içeriğin oyuncu bilgisi yok. Başka birini dene.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {step.cast.map((member) => (
                <li key={member.id}>
                  <button
                    type="button"
                    onClick={() => choose(step.title, member)}
                    disabled={pending}
                    aria-label={`${characterLabel(member)} (${member.name}) karakterini seç`}
                    className="group hover:border-primary w-full overflow-hidden rounded-xl border text-left transition-colors disabled:opacity-60"
                  >
                    <span className="bg-muted relative block aspect-square">
                      {member.profileUrl ? (
                        <Image src={member.profileUrl} alt="" fill sizes="180px" className="object-cover object-top" />
                      ) : (
                        <UserRound className="text-muted-foreground absolute inset-0 m-auto size-10" />
                      )}
                    </span>
                    <span className="block p-2">
                      <span className="group-hover:text-primary block truncate text-sm font-bold">
                        {characterLabel(member)}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">{member.name}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Loading() {
  return (
    <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
      <Loader2 className="size-4 animate-spin" />
      Yükleniyor…
    </div>
  );
}
