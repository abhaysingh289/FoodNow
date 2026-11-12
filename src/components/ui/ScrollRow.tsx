"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "./cn";

function Arrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-y-0 z-10 hidden w-16 items-center pointer-fine:flex",
        side === "left" ? "left-0 justify-start bg-linear-to-r" : "right-0 justify-end bg-linear-to-l",
        "from-surface via-surface/80 to-transparent",
      )}
    >
      <button
        type="button"
        tabIndex={-1} // keyboard users scroll by tabbing through the row's own items
        aria-hidden="true"
        data-testid={`scroll-${side}`}
        onClick={onClick}
        className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-[0_2px_8px_rgb(0_0_0/0.12)] hover:bg-fill"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d={side === "left" ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

/**
 * A horizontally scrolling row without a visible scrollbar. With a mouse (fine pointer), ‹ › buttons
 * appear at whichever edge has more content, since a mouse wheel cannot scroll sideways on its own.
 * Touch devices keep plain swiping.
 */
export function ScrollRow({
  as: Tag = "div",
  className,
  children,
  testId,
}: {
  as?: "div" | "ul";
  className?: string;
  children: React.ReactNode;
  testId?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    const mutate = new MutationObserver(measure); // chips or cards added/removed
    mutate.observe(el, { childList: true, subtree: true });
    return () => {
      el.removeEventListener("scroll", measure);
      resize.disconnect();
      mutate.disconnect();
    };
  }, [measure]);

  const scrollBy = (dir: -1 | 1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.8, 160), behavior: "smooth" });
  };

  return (
    <div className="relative" data-testid={testId}>
      <Tag ref={ref as never} className={cn("no-scrollbar overflow-x-auto", className)}>
        {children}
      </Tag>
      {edges.left && <Arrow side="left" onClick={() => scrollBy(-1)} />}
      {edges.right && <Arrow side="right" onClick={() => scrollBy(1)} />}
    </div>
  );
}
