"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Loader2, Move, X } from "lucide-react";
import { toast } from "sonner";
import { setCoverPosition } from "@/app/actions/cover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const clamp = (n: number) => Math.min(100, Math.max(0, n));
const STEP = 5;

/**
 * The profile cover. Its owner can "Konumu ayarla": drag the image up or down (or use the arrow buttons)
 * to pick which part shows, then save. The position is a 0–100 object-position.
 */
export function CoverBanner({
  src,
  positionY,
  editable,
  children,
}: {
  src: string;
  positionY: number;
  editable: boolean;
  /** Owner's other buttons (change/remove cover) */
  children?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [y, setY] = useState(positionY);
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();
  const container = useRef<HTMLDivElement>(null);
  const aspect = useRef(16 / 9);
  const drag = useRef<{ startY: number; startPos: number } | null>(null);
  const router = useRouter();

  /** How many pixels of the image are hidden above and below together (0: nothing to move). */
  const hiddenHeight = () => {
    const box = container.current;
    if (!box) return 0;
    return box.clientWidth / aspect.current - box.clientHeight;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!editing) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startPos: y };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const hidden = hiddenHeight();
    if (!drag.current || hidden <= 0) return;
    // Dragging the image down shows more of its top
    setY(clamp(drag.current.startPos - ((e.clientY - drag.current.startY) / hidden) * 100));
  };
  const onPointerUp = () => {
    drag.current = null;
    setDragging(false);
  };

  const save = () =>
    startTransition(async () => {
      const result = await setCoverPosition(Math.round(y));
      if (!result.ok) return void toast.error(result.error);
      setEditing(false);
      router.refresh();
      toast.success("Kapağın konumu kaydedildi.");
    });

  const cancel = () => {
    setY(positionY);
    setEditing(false);
  };

  return (
    <div
      ref={container}
      className={cn(
        "bg-muted relative -mx-4 aspect-[2/1] overflow-hidden select-none sm:mx-0 sm:aspect-[3/1] sm:rounded-3xl",
        // Above the name row that overlaps the cover's bottom edge, so nothing covers the controls
        editing && "z-10",
      )}
      style={editing ? { cursor: dragging ? "grabbing" : "grab", touchAction: "none" } : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <Image
        src={src}
        alt="Profil kapağı"
        fill
        priority
        unoptimized
        draggable={false}
        className="object-cover"
        style={{ objectPosition: `50% ${Math.round(y)}%` }}
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth && img.naturalHeight) aspect.current = img.naturalWidth / img.naturalHeight;
        }}
      />
      {!editing && (
        <div className="from-background pointer-events-none absolute inset-0 bg-gradient-to-t via-transparent to-transparent" />
      )}

      {editable && !editing && (
        <div className="absolute top-3 right-3 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            <Move />
            Konumu ayarla
          </Button>
          {children}
        </div>
      )}

      {editing && (
        <>
          <p className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto w-fit -translate-y-1/2 rounded-md bg-black/70 px-3 py-1.5 text-sm font-semibold text-white">
            Görseli yukarı aşağı sürükle
          </p>
          <div className="absolute top-3 right-3 flex gap-2" onPointerDown={(e) => e.stopPropagation()}>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Görseli yukarı kaydır"
              onClick={() => setY((v) => clamp(v + STEP))}
            >
              <ArrowUp />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Görseli aşağı kaydır"
              onClick={() => setY((v) => clamp(v - STEP))}
            >
              <ArrowDown />
            </Button>
            <Button variant="secondary" size="sm" onClick={cancel} disabled={pending}>
              <X />
              Vazgeç
            </Button>
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Check />}
              Kaydet
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
