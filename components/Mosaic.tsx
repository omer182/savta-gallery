import type { ReactNode } from "react";
import s from "./gallery.module.css";

/**
 * Justified rows — no JavaScript.
 *
 * This replaces a row-span masonry that needed a measurement pass on every
 * resize and image load. Flexbox does the same job exactly (see the maths on
 * .grid), so the layout is correct before hydration and cannot be wrong if a
 * script never runs.
 */
export function Mosaic({ children }: { children: ReactNode }) {
  return <div className={s.grid}>{children}</div>;
}

/**
 * One tile. `ratio` is height/width as stored; flexbox wants width/height, so
 * it is inverted here.
 */
export function Tile({
  children,
  index,
  ratio,
}: {
  children: ReactNode;
  index: number;
  ratio: number;
}) {
  const r = ratio > 0 ? 1 / ratio : 1;
  return (
    <div
      className={s.card}
      style={
        {
          // Clamped: a panorama or a very tall canvas would otherwise dominate
          // or vanish in a row.
          "--r": Math.max(0.45, Math.min(2.6, r)),
          "--i": index % 12,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
