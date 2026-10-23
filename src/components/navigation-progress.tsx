"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * A thin bar at the top while a new page loads, so a click never feels ignored. Starts on the router's
 * transition event (instrumentation-client.ts) and finishes when the address has changed.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  const target = useRef<string | null>(null);

  useEffect(() => {
    const start = (e: Event) => {
      const url = new URL((e as CustomEvent<string>).detail, window.location.href);
      // Same address (e.g. a hash link): nothing to wait for
      if (url.pathname + url.search === window.location.pathname + window.location.search) return;
      target.current = url.pathname + url.search;
      clearInterval(timer.current);
      // The event comes from inside the router's transition, where a state update would wait for the new page;
      // a timeout makes it an ordinary update that shows at once
      setTimeout(() => {
        if (target.current === null) return;
        setProgress(8);
        // Creeps towards 90% until the page arrives
        timer.current = setInterval(() => setProgress((p) => (p === null ? p : p + (90 - p) * 0.08)), 200);
      }, 0);
    };
    window.addEventListener("tracker:navigation-start", start);
    return () => {
      window.removeEventListener("tracker:navigation-start", start);
      clearInterval(timer.current);
    };
  }, []);

  // The address changed: the new page is on screen
  useEffect(() => {
    if (target.current === null) return;
    target.current = null;
    clearInterval(timer.current);
    setProgress(100);
    const hide = setTimeout(() => setProgress(null), 250);
    return () => clearTimeout(hide);
  }, [pathname, searchParams]);

  if (progress === null) return null;
  return (
    <div
      role="progressbar"
      aria-label="Sayfa yükleniyor"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
      className="bg-primary pointer-events-none fixed top-0 left-0 z-50 h-0.5 transition-[width] duration-200"
      style={{ width: `${progress}%` }}
    />
  );
}
