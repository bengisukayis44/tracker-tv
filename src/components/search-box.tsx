"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Film, Search, Tv, User, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Suggestion } from "@/lib/suggest";
import { cn } from "@/lib/utils";

const ICONS = { series: Tv, movie: Film, person: UserRound, user: User } as const;
const DEBOUNCE_MS = 200;

/**
 * The search text box with suggestions while typing (WAI-ARIA combobox): series, movies, actors and users,
 * plus "all results". Arrow keys move, Enter opens the highlighted one or runs the full search, Escape closes.
 */
export function SearchBox({
  defaultValue = "",
  placeholder,
  ariaLabel,
  autoFocus,
  className,
}: {
  defaultValue?: string;
  placeholder: string;
  ariaLabel: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loadedFor, setLoadedFor] = useState("");
  const router = useRouter();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const q = value.trim();
  useEffect(() => {
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!res.ok) return;
        const data: { suggestions: Suggestion[] } = await res.json();
        setSuggestions(data.suggestions);
        setLoadedFor(q);
        setActive(-1);
      } catch {
        // A newer keystroke aborted it, or the network failed: the plain search still works
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  // Old suggestions stay while the next ones load, so the list does not flicker
  const items = q.length >= 2 ? suggestions : [];
  const allHref = `/search?q=${encodeURIComponent(q)}`;
  const options = [...items.map((s) => ({ href: s.href, suggestion: s })), { href: allHref, suggestion: null }];
  const showList = open && q.length >= 2 && loadedFor !== "";

  const go = (href: string) => {
    setOpen(false);
    inputRef.current?.blur();
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!showList) return setOpen(true);
      e.preventDefault();
      const delta = e.key === "ArrowDown" ? 1 : -1;
      // -1 (back in the box) and every option, round and round
      const slots = options.length + 1;
      setActive((i) => ((i + 1 + delta + slots) % slots) - 1);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    } else if (e.key === "Enter" && showList && active >= 0 && active < options.length) {
      e.preventDefault();
      go(options[active].href);
    }
  };

  return (
    <div className={cn("relative flex-1", className)}>
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        ref={inputRef}
        name="q"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={`${id}-list`}
        aria-activedescendant={showList && active >= 0 ? `${id}-option-${active}` : undefined}
        autoComplete="off"
        autoFocus={autoFocus}
        className="h-10 pl-9"
      />
      {showList && (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label="Öneriler"
          className="bg-popover text-popover-foreground absolute inset-x-0 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-xl border p-1 text-left shadow-lg"
        >
          {options.map((o, i) => {
            const s = o.suggestion;
            const Icon = s ? ICONS[s.kind] : Search;
            return (
              <li
                key={o.href}
                id={`${id}-option-${i}`}
                role="option"
                aria-selected={i === active}
                // Keeps the focus in the box, so the click is not lost to blur
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(o.href)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5",
                  i === active && "bg-muted",
                  !s && items.length > 0 && "mt-1 border-t pt-2",
                )}
              >
                {s?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- tiny thumbnails straight from TMDB/Supabase
                  <img
                    src={s.imageUrl}
                    alt=""
                    className={cn(
                      "bg-muted size-10 shrink-0 object-cover",
                      s.kind === "person" || s.kind === "user" ? "rounded-full" : "h-12 w-8 rounded",
                    )}
                  />
                ) : (
                  <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-full">
                    <Icon className="size-4" />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {s ? s.name : `"${q}" için tüm sonuçlar`}
                  </span>
                  {s && <span className="text-muted-foreground block truncate text-xs">{s.detail}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
