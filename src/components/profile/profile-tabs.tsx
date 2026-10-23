"use client";

import { useId, useRef, useState } from "react";
import { ScrollRow } from "@/components/scroll-row";
import { cn } from "@/lib/utils";

export type ProfileTab = { value: string; label: string; count: number; panel: React.ReactNode };

/**
 * Profile tabs. Every panel is rendered on the server; switching only changes which one is shown and keeps
 * the address in sync (?sekme=…) without a navigation, so it works around Next.js 15.5's search-param bug.
 */
export function ProfileTabs({ tabs, initial }: { tabs: ProfileTab[]; initial: string }) {
  const [active, setActive] = useState(tabs.some((t) => t.value === initial) ? initial : tabs[0].value);
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (value: string) => {
    setActive(value);
    const url = new URL(window.location.href);
    if (value === tabs[0].value) url.searchParams.delete("sekme");
    else url.searchParams.set("sekme", value);
    window.history.replaceState(null, "", url);
  };

  // Arrow keys move between tabs (WAI-ARIA tabs pattern)
  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + tabs.length) % tabs.length;
    select(tabs[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div className="space-y-6">
      <ScrollRow as="div" label="Profil bölümleri" size="sm" className="-mx-4 px-4 sm:mx-0 sm:px-0">
        <div role="tablist" aria-label="Profil bölümleri" className="flex w-max gap-1 border-b pb-px">
          {tabs.map((tab, i) => {
            const selected = tab.value === active;
            return (
              <button
                key={tab.value}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                id={`${id}-tab-${tab.value}`}
                role="tab"
                type="button"
                aria-selected={selected}
                aria-controls={`${id}-panel-${tab.value}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(tab.value)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={cn(
                  "-mb-px border-b-2 px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors",
                  selected
                    ? "border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground border-transparent",
                )}
              >
                {tab.label}
                <span className="text-muted-foreground ml-1.5 font-normal">{tab.count}</span>
              </button>
            );
          })}
        </div>
      </ScrollRow>

      {tabs.map((tab) => (
        <div
          key={tab.value}
          id={`${id}-panel-${tab.value}`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${tab.value}`}
          hidden={tab.value !== active}
        >
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
