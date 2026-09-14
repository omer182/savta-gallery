"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import s from "./gallery.module.css";

/*
 * Fallback gutter, used only if the computed style cannot be read. The real
 * value comes from the grid itself, so the breakpoints in the stylesheet stay
 * the single source of truth.
 */
const GUTTER_FALLBACK = 26;

/** useLayoutEffect warns when it runs on the server, where it does nothing. */
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * The mosaic - the mock's gallery, with only its column mechanism replaced.
 *
 * The mock used CSS `columns`, which fills column 1 top to bottom before
 * starting column 2 and would scramble sort_order (2). This is grid with row
 * spans instead, so DOM order stays reading order. It looks the same.
 *
 * Each tile is measured and given a span, because a tile is no longer just its
 * painting: the caption under the frame is as tall as its title needs, and
 * only the browser knows that.
 *
 * The measuring cannot leave the gallery broken. Until `laid` is added the
 * grid is an ordinary even-row grid showing every painting at full size - no
 * card is parked invisible, and none carries a span waiting to be corrected.
 * A script that never arrives leaves a tidy gallery rather than a ruined one.
 */
export function Mosaic({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  const measure = useCallback(() => {
    const grid = ref.current;
    if (!grid) return;

    const cs = getComputedStyle(grid);
    // The resolved row height, never the `gap` shorthand - reading the
    // shorthand off a computed style is what broke this the first time.
    const row = parseFloat(cs.gridAutoRows) || 4;
    /*
     * column-gap, not row-gap: `laid` sets row-gap to 0 and carries the
     * vertical gutter inside each span instead, because an N-row span would
     * otherwise also accumulate N-1 gaps and the arithmetic would drift. The
     * column gap is the same measure and survives the switch.
     */
    const gutter = parseFloat(cs.columnGap) || GUTTER_FALLBACK;
    const cards = Array.from(grid.children) as HTMLElement[];

    /*
     * Every read, then every write. Interleaving them makes the browser flush
     * layout on each card in turn, and the gallery grows to ~500 tiles as she
     * scrolls - at that size the difference is between imperceptible and a
     * visible stall on each new page.
     *
     * align-self:start keeps a card's height its content height even once a
     * span is set, so re-measuring is stable rather than self-reinforcing.
     */
    const heights = cards.map((c) => c.getBoundingClientRect().height);

    let measured = false;
    cards.forEach((card, i) => {
      const h = heights[i] ?? 0;
      if (h <= 0) return; // not laid out yet; a later observer pass catches it
      card.style.setProperty("--span", String(Math.ceil((h + gutter) / row)));
      measured = true;
    });

    // Only switch to masonry once something actually measured, so a pass that
    // runs too early can never collapse every tile to a single row.
    if (measured) grid.classList.add(s.laid);
  }, []);

  /*
   * Appending a page resizes the grid and every tile in it, so the observer
   * below can fire hundreds of times for one batch. Coalesce to one pass per
   * frame.
   */
  const frame = useRef(0);
  const layout = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(measure);
  }, [measure]);

  // Before paint, so the first frame is already the mosaic. This does not run
  // on the server, so the SSR markup stays the plain grid - which is exactly
  // the intended no-script rendering.
  useIsomorphicLayoutEffect(() => {
    // Synchronous, not the coalesced version: the first painted frame has to
    // be the mosaic already, not an even grid corrected one frame later.
    measure();
  }, [measure, children]);

  useEffect(() => {
    // Heights settle after mount: the blur-up swaps in the real image, and the
    // fonts load and reflow the caption. Remeasure on any of it.
    const grid = ref.current;
    const ro = new ResizeObserver(layout);
    if (grid) {
      ro.observe(grid);
      for (const c of Array.from(grid.children)) ro.observe(c);
    }
    window.addEventListener("resize", layout);
    document.fonts?.ready.then(layout).catch(() => {});

    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame.current);
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
 * One tile - the mock's <figure>: the framed painting, then its caption.
 *
 * `index` only drives the staggered entry animation. `ratio` no longer sets
 * the layout now that tiles are measured, but the image inside still sizes its
 * own box from it, which is what stops the wall reflowing as paintings load.
 */
export function Tile({
  children,
  index,
}: {
  children: ReactNode;
  index: number;
  ratio?: number;
}) {
  return (
    <figure className={s.card} style={{ "--i": index % 12 } as CSSProperties}>
      {children}
    </figure>
  );
}
