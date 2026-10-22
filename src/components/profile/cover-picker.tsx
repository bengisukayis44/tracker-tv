"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronLeft, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  getCoverImages,
  getCoverTitles,
  removeCover,
  setCover,
  type CoverTitle,
  type EpisodeStill,
} from "@/app/actions/cover";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { COVER_FIRST, COVER_MORE, coverImageUrl } from "@/lib/cover";
import { cn } from "@/lib/utils";

type Images = { scenes: string[]; stills: EpisodeStill[] };
type Tab = "scenes" | "stills";
type Step =
  { kind: "titles"; titles: CoverTitle[] | null } | { kind: "images"; title: CoverTitle; images: Images | null };

/** "Kapak ekle": pick one of the series/movies you watched, then one of its images or episode stills. */
export function CoverPicker({ hasCover, className }: { hasCover: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>({ kind: "titles", titles: null });
  const [error, setError] = useState<string>();
  const [tab, setTab] = useState<Tab>("scenes");
  // How many of each list are shown; "Daha fazla göster" adds COVER_MORE
  const [shown, setShown] = useState({ scenes: COVER_FIRST, stills: COVER_FIRST });
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
    setTab("scenes");
    setShown({ scenes: COVER_FIRST, stills: COVER_FIRST });
    startTransition(async () => {
      const result = await getCoverImages({ type: title.type, tmdbId: title.tmdbId });
      if (!result.ok) return setError(result.error);
      setStep({ kind: "images", title, images: { scenes: result.scenes, stills: result.stills } });
      // A series with no wide images still has its episode stills
      if (result.scenes.length === 0 && result.stills.length > 0) setTab("stills");
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
          ) : step.images.scenes.length === 0 && step.images.stills.length === 0 ? (
            <p className="text-muted-foreground text-sm">Bu içerik için uygun görsel bulunamadı. Başka birini dene.</p>
          ) : (
            <ImageGrid
              title={step.title}
              images={step.images}
              tab={tab}
              onTab={setTab}
              shown={shown[tab]}
              onMore={() => setShown((s) => ({ ...s, [tab]: s[tab] + COVER_MORE }))}
              onChoose={choose}
              disabled={pending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** "Dizi görselleri" and "Bölüm kareleri" tabs with a growing grid of images. */
function ImageGrid({
  title,
  images,
  tab,
  onTab,
  shown,
  onMore,
  onChoose,
  disabled,
}: {
  title: CoverTitle;
  images: Images;
  tab: Tab;
  onTab: (tab: Tab) => void;
  shown: number;
  onMore: () => void;
  onChoose: (title: CoverTitle, path: string) => void;
  disabled: boolean;
}) {
  const items =
    tab === "scenes"
      ? images.scenes.map((path, i) => ({ path, label: null, name: `${i + 1}. görseli kapak yap` }))
      : images.stills.map((still) => ({
          path: still.path,
          label: still.label,
          name: `${still.label} karesini kapak yap`,
        }));
  const tabs = [
    { value: "scenes" as const, label: "Dizi görselleri", count: images.scenes.length },
    { value: "stills" as const, label: "Bölüm kareleri", count: images.stills.length },
  ].filter((t) => t.count > 0);
  const remaining = items.length - shown;

  return (
    <div className="space-y-4">
      {tabs.length > 1 && (
        <div role="tablist" aria-label="Görsel türü" className="bg-muted inline-flex rounded-lg p-1">
          {tabs.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => onTab(t.value)}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-semibold transition-colors",
                tab === t.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label} <span className="text-muted-foreground font-normal">{t.count}</span>
            </button>
          ))}
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {items.slice(0, shown).map((item) => (
          <li key={item.path}>
            <button
              type="button"
              onClick={() => onChoose(title, item.path)}
              disabled={disabled}
              aria-label={item.name}
              className="hover:ring-primary focus-visible:ring-primary relative block aspect-video w-full overflow-hidden rounded-lg border outline-none hover:ring-2 focus-visible:ring-2 disabled:opacity-60"
            >
              {/* Straight from TMDB (already small): hundreds of stills would use up Vercel's image quota. Loads when scrolled into view. */}
              <Image src={coverImageUrl(item.path, "w300")} alt="" fill unoptimized className="object-cover" />
              {item.label && (
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/70 px-2 py-1 text-left text-xs font-semibold text-white">
                  {item.label}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {remaining > 0 && (
        <Button variant="outline" className="w-full" onClick={onMore}>
          Daha fazla göster ({remaining} görsel daha)
        </Button>
      )}
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
