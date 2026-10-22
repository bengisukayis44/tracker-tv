"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronLeft, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getCoverImages, getCoverTitles, removeCover, setCover, type CoverTitle } from "@/app/actions/cover";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { coverImageUrl } from "@/lib/cover";
import { cn } from "@/lib/utils";

type Step =
  { kind: "titles"; titles: CoverTitle[] | null } | { kind: "images"; title: CoverTitle; images: string[] | null };

/** "Kapak ekle": pick one of the series/movies you watched, then one of its scene images. */
export function CoverPicker({ hasCover, className }: { hasCover: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>({ kind: "titles", titles: null });
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const showTitles = () => {
    setError(undefined);
    setStep({ kind: "titles", titles: null });
    startTransition(async () => {
      const result = await getCoverTitles();
      if (!result.ok) return setError(result.error);
      setStep({ kind: "titles", titles: result.titles });
    });
  };

  const openPicker = () => {
    setOpen(true);
    showTitles();
  };

  const showImages = (title: CoverTitle) => {
    setError(undefined);
    setStep({ kind: "images", title, images: null });
    startTransition(async () => {
      const result = await getCoverImages({ type: title.type, tmdbId: title.tmdbId });
      if (!result.ok) return setError(result.error);
      setStep({ kind: "images", title, images: result.images });
    });
  };

  const choose = (title: CoverTitle, path: string) =>
    startTransition(async () => {
      const result = await setCover({ type: title.type, tmdbId: title.tmdbId, path });
      if (!result.ok) return setError(result.error);
      setOpen(false);
      router.refresh();
      toast.success("Profil kapağın güncellendi.");
    });

  const remove = () =>
    startTransition(async () => {
      const result = await removeCover();
      if (!result.ok) return void toast.error(result.error);
      router.refresh();
      toast.success("Profil kapağın kaldırıldı.");
    });

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Button variant="secondary" size="sm" onClick={openPicker}>
        <ImagePlus />
        {hasCover ? "Kapağı değiştir" : "Kapak ekle"}
      </Button>
      {hasCover && (
        <Button variant="secondary" size="sm" onClick={remove} disabled={pending} aria-label="Kapağı kaldır">
          <Trash2 />
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{step.kind === "titles" ? "Kapak için bir dizi ya da film seç" : step.title.name}</DialogTitle>
            <DialogDescription>
              {step.kind === "titles"
                ? "İzlediğin diziler ve filmler, en son izlediğin başta."
                : "Kapak yapmak istediğin görsele dokun."}
            </DialogDescription>
          </DialogHeader>

          {step.kind === "images" && (
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
                Henüz bir dizi bölümü ya da film izlemedin. İzledim olarak işaretlediklerin burada görünür.
              </p>
            ) : (
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {step.titles.map((title) => (
                  <li key={`${title.type}-${title.tmdbId}`}>
                    <button
                      type="button"
                      onClick={() => showImages(title)}
                      className="group w-full space-y-1 text-left"
                    >
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
          ) : step.images === null ? (
            <Loading />
          ) : step.images.length === 0 ? (
            <p className="text-muted-foreground text-sm">Bu içerik için uygun görsel bulunamadı. Başka birini dene.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {step.images.map((path, i) => (
                <li key={path}>
                  <button
                    type="button"
                    onClick={() => choose(step.title, path)}
                    disabled={pending}
                    aria-label={`${i + 1}. görseli kapak yap`}
                    className="hover:ring-primary focus-visible:ring-primary relative block aspect-video w-full overflow-hidden rounded-lg border outline-none hover:ring-2 focus-visible:ring-2 disabled:opacity-60"
                  >
                    <Image
                      src={coverImageUrl(path, "w300")}
                      alt=""
                      fill
                      sizes="(min-width: 640px) 360px, 90vw"
                      className="object-cover"
                    />
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
