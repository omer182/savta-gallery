"use client";

import { type ReactNode, useCallback, useEffect, useRef } from "react";
import s from "./gallery.module.css";

/**
 * Column mosaic — fixed columns, staggered tiles.
 *
 * Each tile's measured height becomes a grid row-span, so tiles of different
 * proportions interlock instead of sitting in uniform rows. Deliberately not
 * CSS `columns`, which fills one column top to bottom before starting the
 * next and would scramble sort_order (§2); here DOM order stays reading order.
 *
 * This is the one layout that genuinely needs JavaScript: a span depends on
 * the tile's height in pixels, which depends on the column width, which is not
 * knowable server-side — and native CSS masonry is not shipped. The CSS
 * fallback (see .card) degrades to plain even columns if this never runs, so
 * the gallery can never come out blank.
 */
export function Mosaic({ children }: { children: ReactNode }) {
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
      if (h <= 0) continue; // not laid out yet; a later observer pass will catch it
      card.style.gridRowEnd = `span ${Math.max(1, Math.ceil((h + gap) / (row + gap)))}`;
    }
  }, []);

  useEffect(() => {
    layout();

    // Heights settle after mount: the blur-up swaps in the real image, fonts
    // load and reflow the placard. Remeasure on any of it rather than once.
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

/** One tile. `index` only drives the staggered entry animation. */
export function Tile({ children, index }: { children: ReactNode; index: number; ratio?: number }) {
  return (
    <div className={s.card} style={{ "--i": index % 12 } as React.CSSProperties}>
      {children}
    </div>
  );
}
