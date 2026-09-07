import type { CSSProperties, ReactNode } from "react";
import s from "./gallery.module.css";

/**
 * The mosaic.
 *
 * There is no JavaScript here on purpose. A tile height is the column width
 * times the aspect ratio of the painting, and the CSS in gallery.module.css
 * gets the column width from container query units — so the only thing the
 * server has to supply is the ratio, as a row span.
 *
 * The consequence is that the wall is correct in the very first paint: no
 * measure-then-reflow, nothing to go wrong before hydration, and it stays
 * correct through a window resize or a column-count change without a single
 * line of script.
 *
 * The extra <div> is not decorative — container query units resolve against
 * the nearest ANCESTOR container, so the grid cannot be its own container.
 */
export function Mosaic({ children }: { children: ReactNode }) {
  return (
    <div className={s.mosaic}>
      <div className={s.grid}>{children}</div>
    </div>
  );
}

/**
 * The vertical gutter, in grid rows.
 *
 * One row is 1% of a column width, so this is the row form of --gut-f in
 * gallery.module.css — KEEP THE TWO IN SYNC (0.12 there, 12 here).
 *
 * It is reserved inside each span instead of being a row-gap: with a real
 * row-gap an N-row span would also pick up N-1 gaps, and a tile height would
 * stop being a clean multiple of the row unit.
 */
const GUTTER_ROWS = 12;

/**
 * One tile.
 *
 * `ratio` is height / width, and it must be the SAME number the image inside
 * sizes its box from, or the tile the mosaic reserves will not match what gets
 * drawn in it and the columns will collide. toCardView guards the value; a
 * painting is never cropped to fit a tile.
 *
 * `index` only drives the staggered entry animation.
 */
export function Tile({
  children,
  index,
  ratio = 1,
}: {
  children: ReactNode;
  index: number;
  ratio?: number;
}) {
  const r = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;

  return (
    <div
      className={s.card}
      style={
        { "--i": index % 12, "--span": Math.round(r * 100) + GUTTER_ROWS } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
