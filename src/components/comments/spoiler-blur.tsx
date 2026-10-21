"use client";

import { useState } from "react";
import { EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Hides a spoiler until the reader asks for it. The text is not rendered at all while hidden,
 * so it cannot be read by selecting it or with a screen reader either.
 */
export function SpoilerBlur({ children, initiallyRevealed }: { children: React.ReactNode; initiallyRevealed: boolean }) {
  const [revealed, setRevealed] = useState(initiallyRevealed);
  if (revealed) return children;

  return (
    <div className="bg-muted/60 relative overflow-hidden rounded-lg border border-dashed px-4 py-3">
      <div aria-hidden className="space-y-1.5 blur-sm select-none">
        <div className="bg-foreground/20 h-3 w-11/12 rounded" />
        <div className="bg-foreground/20 h-3 w-3/4 rounded" />
      </div>
      <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-3">
        <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm font-semibold">
          <EyeOff className="size-4" />
          Bu yorum spoiler içeriyor
        </span>
        <Button variant="secondary" size="sm" onClick={() => setRevealed(true)}>
          Spoiler&apos;ı göster
        </Button>
      </div>
    </div>
  );
}
