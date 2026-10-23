"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Long text clamped to a few lines, with "Devamını oku". */
export function ShowMoreText({ text, lines = 5 }: { text: string; lines?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <p
        className="text-foreground/85 leading-relaxed whitespace-pre-line"
        style={
          open
            ? undefined
            : { display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" }
        }
      >
        {text}
      </p>
      {text.length > 400 && (
        <Button variant="link" className="h-auto p-0" onClick={() => setOpen(!open)}>
          {open ? "Daha az göster" : "Devamını oku"}
        </Button>
      )}
    </div>
  );
}

/** A grid that shows the first `first` children and the rest on "Tümünü göster". */
export function ExpandableGrid({
  first,
  total,
  className,
  children,
}: {
  first: number;
  total: number;
  className?: string;
  children: React.ReactNode[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-4">
      <div className={className}>{open ? children : children.slice(0, first)}</div>
      {total > first && (
        <Button variant="outline" className="w-full" onClick={() => setOpen(!open)}>
          {open ? "Daha az göster" : `Tümünü göster (${total})`}
        </Button>
      )}
    </div>
  );
}
