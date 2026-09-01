/** Pure formatting helpers — safe to import from client components. */

/** Placard dimensions, e.g. `80 × 60 ס"מ`. */
export function formatSize(w: number | null | undefined, h: number | null | undefined) {
  if (!w || !h) return null;
  const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  return `${n(w)} × ${n(h)} ס"מ`;
}
