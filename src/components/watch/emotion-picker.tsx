"use client";

import { EMOTIONS, type EmotionValue } from "@/lib/emotions";
import { cn } from "@/lib/utils";

/** Multi-select emotion chips. */
export function EmotionPicker({
  value,
  onChange,
}: {
  value: EmotionValue[];
  onChange: (value: EmotionValue[]) => void;
}) {
  const toggle = (emotion: EmotionValue) =>
    onChange(value.includes(emotion) ? value.filter((e) => e !== emotion) : [...value, emotion]);

  return (
    <div role="group" aria-label="Duygular" className="flex flex-wrap gap-2">
      {EMOTIONS.map((emotion) => {
        const selected = value.includes(emotion.value);
        return (
          <button
            key={emotion.value}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(emotion.value)}
            className={cn(
              "focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2",
              selected
                ? "border-primary bg-primary/15 text-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            <span aria-hidden>{emotion.emoji}</span>
            {emotion.label}
          </button>
        );
      })}
    </div>
  );
}

/** Read-only chips for saved emotions. */
export function EmotionList({ value }: { value: string[] }) {
  if (value.length === 0) return null;
  return (
    <ul aria-label="Seçtiğin duygular" className="flex flex-wrap gap-1.5">
      {EMOTIONS.filter((e) => value.includes(e.value)).map((e) => (
        <li
          key={e.value}
          className="bg-secondary inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
        >
          <span aria-hidden>{e.emoji}</span>
          {e.label}
        </li>
      ))}
    </ul>
  );
}
