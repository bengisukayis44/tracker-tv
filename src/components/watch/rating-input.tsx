"use client";

import { cn } from "@/lib/utils";

/** 1–10 rating picker; choosing the selected value again clears it. */
export function RatingInput({ value, onChange }: { value: number | null; onChange: (value: number | null) => void }) {
  return (
    <div role="radiogroup" aria-label="Puan (1-10)" className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
        const selected = value === n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${n} puan`}
            onClick={() => onChange(selected ? null : n)}
            className={cn(
              "focus-visible:ring-ring h-10 rounded-lg border text-sm font-bold transition-colors outline-none focus-visible:ring-2",
              selected
                ? "border-amber-400 bg-amber-400 text-black"
                : value != null && n <= value
                  ? "border-amber-400/40 bg-amber-400/15 text-amber-300"
                  : "bg-secondary text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
