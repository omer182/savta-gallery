"use client";

import { type ReactNode, useCallback, useEffect, useRef } from "react";
import s from "./gallery.module.css";

/**
 * CSS Grid row-span masonry (PLAN.md §2). Deliberately not CSS `columns`, which
 * fills column-by-column and would scramble sort_order — with pagination that
 * misordering is very visible.
 *
 * Each child's measured height is converted to a span count, so the grid packs
 * like masonry while DOM order stays reading order (right→left under RTL).
 */
export function Masonry({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  const layout = useCallback(() => {
    const grid = ref.current;
    if (!grid) return;
    const cs = getComputedStyle(grid);
    const gap = parseFloat(cs.rowGap) || 0;
    const row = parseFloat(cs.gridAutoRows) || 1;

    for (const card of Array.from(grid.children) as HTMLElement[]) {
      const inner = card.firstElementChild as HTMLElement | null;
      if (!inner) continue;
      const h = inner.getBoundingClientRect().height;
      card.style.gridRowEnd = `span ${Math.max(1, Math.ceil((h + gap) / (row + gap)))}`;
    }
  }, []);

  useEffect(() => {
    layout();

    // Images settle after layout (blur-up swap, font load, lazy decode), so
    // remeasure on any size change rather than only on mount.
    const ro = new ResizeObserver(layout);
    const grid = ref.current;
    if (grid) {
      ro.observe(grid);
      for (const c of Array.from(grid.children)) {
        const inner = c.firstElementChild;
        if (inner) ro.observe(inner);
      }
    }
    window.addEventListener("resize", layout);
    document.fonts?.ready.then(layout).catch(() => {});

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", layout);
    };
  }, [layout, children]);

  return (
    <div className={s.grid} ref={ref}>
      {children}
    </div>
  );
}

/**
 * Carries the stagger index only. The entry animation itself is pure CSS, so a
 * card is visible whether or not this component's JavaScript ever runs — see
 * the note on .card in gallery.module.css.
 */
export function Reveal({ children, index }: { children: ReactNode; index: number }) {
  return (
    <div className={s.card} style={{ "--i": index % 12 } as React.CSSProperties}>
      {children}
    </div>
  );
}
