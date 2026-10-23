"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A row that scrolls sideways without a scrollbar: an arrow shows at each end that has more to see
 * (none at the start, none at the end). Swiping and the keyboard work as usual.
 */
export function ScrollRow({
  as: Tag = "ul",
  label,
  focusable = false,
  size = "lg",
  className,
  children,
}: {
  as?: "ul" | "ol" | "div";
  /** Names the scroll area (also for the arrows) */
  label: string;
  /** Lets the row itself take focus when nothing inside it can (keyboard scrolling) */
  focusable?: boolean;
  /** "lg": round buttons over poster rows; "sm": small ones for tab bars */
  size?: "lg" | "sm";
  className?: string;
  children: React.ReactNode;
}) {
  const scroller = useRef<HTMLElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const update = useCallback(() => {
    const box = scroller.current;
    if (!box) return;
    // 2 px slack for fractional scroll positions
    setEdges({ start: box.scrollLeft > 2, end: box.scrollLeft + box.clientWidth < box.scrollWidth - 2 });
  }, []);

  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(box);
    return () => observer.disconnect();
  }, [update]);

  const scroll = (direction: -1 | 1) => {
    const box = scroller.current;
    if (box) box.scrollBy({ left: direction * box.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <Tag
        ref={scroller as never}
        tabIndex={focusable ? 0 : undefined}
        // Lists can carry a name; a plain div may not (ARIA)
        aria-label={Tag === "div" ? undefined : label}
        onScroll={update}
        className={cn(
          "focus-visible:ring-ring flex overflow-x-auto outline-none focus-visible:ring-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          className,
        )}
      >
        {children}
      </Tag>
      {edges.start && <Arrow side="left" size={size} label={label} onClick={() => scroll(-1)} />}
      {edges.end && <Arrow side="right" size={size} label={label} onClick={() => scroll(1)} />}
    </div>
  );
}

function Arrow({
  side,
  size,
  label,
  onClick,
}: {
  side: "left" | "right";
  size: "lg" | "sm";
  label: string;
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      // Phones swipe; the arrows are for mouse and keyboard
      tabIndex={-1}
      aria-label={`${label}: ${side === "left" ? "geri" : "ileri"} kaydır`}
      className={cn(
        "bg-background/90 text-foreground hover:bg-accent absolute z-10 hidden items-center justify-center border shadow-lg backdrop-blur transition-colors sm:flex",
        size === "lg"
          ? "top-[40%] size-10 -translate-y-1/2 rounded-full"
          : "top-1/2 size-7 -translate-y-1/2 rounded-md",
        side === "left" ? (size === "lg" ? "-left-4" : "left-0") : size === "lg" ? "-right-4" : "right-0",
      )}
    >
      <Icon className={size === "lg" ? "size-5" : "size-4"} />
    </button>
  );
}
