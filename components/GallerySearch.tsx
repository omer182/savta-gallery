"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CardView } from "@/lib/cardView";
import s from "./gallery.module.css";
import { Mosaic, Tile } from "./Mosaic";
import { PaintingCard } from "./PaintingCard";

/**
 * Search, in place on the gallery.
 *
 * Tapping חיפוש opens a field above the tag strip rather than moving to
 * another page: the wall stays where it was, and closing the field puts it
 * back exactly as it was left.
 *
 * The tag strip stays on screen while searching. It is the other way into the
 * archive, and hiding it the moment the field opens would make the two feel
 * like alternatives rather than two ways of narrowing the same wall.
 *
 * Only the results re-render as she types, so the field keeps focus and cursor
 * position. The URL is kept in step with replaceState - shareable, without
 * pushing a history entry per keystroke.
 */
export function GallerySearch({
  open,
  initialQuery = "",
  tags,
  children,
}: {
  open: boolean;
  initialQuery?: string;
  tags: ReactNode;
  /** The wall, shown whenever the field is empty. */
  children: ReactNode;
}) {
  const [q, setQ] = useState(initialQuery);
  const [items, setItems] = useState<CardView[] | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    const ac = new AbortController();

    /*
     * Everything happens inside the debounce, never synchronously in the
     * effect body: a fast typist would otherwise fire a request per keystroke
     * and see the spinner flash on every one. The abort also stops an earlier
     * slow response from overwriting a newer one.
     */
    const t = setTimeout(async () => {
      if (!term) {
        setItems(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: ac.signal,
        });
        const data = (await res.json()) as { items: CardView[] };
        setItems(data.items);
      } catch {
        /* aborted or offline - keep the previous results on screen */
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [q, open]);

  // Shareable without a history entry per keystroke.
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    window.history.replaceState(
      null,
      "",
      term ? `/?search=1&q=${encodeURIComponent(term)}` : "/?search=1",
    );
  }, [q, open]);

  if (!open) {
    return (
      <>
        {tags}
        {children}
      </>
    );
  }

  return (
    <>
      <div className={s.searchbar}>
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="חיפוש לפי שם, סיפור או תגית…"
          aria-label="חיפוש ציורים"
          /*
           * dir="rtl", not dir="auto". An empty field has no strong character
           * for auto to read, so it falls back to LTR and parks the Hebrew
           * placeholder against the left edge - the one moment the placeholder
           * is the only thing there to see.
           */
          dir="rtl"
        />
        <div className={s.searchCount} role="status" aria-live="polite">
          {loading
            ? "מחפש…"
            : items === null
              ? "הקלידו כדי לחפש בציורים ובסיפורים"
              : items.length === 1
                ? "תוצאה אחת"
                : `${items.length} תוצאות`}
        </div>
      </div>

      {tags}

      {items === null ? (
        children
      ) : items.length === 0 ? (
        <div className={s.empty}>לא נמצאו ציורים. נסו מילה אחרת.</div>
      ) : (
        <Mosaic>
          {items.map((p, i) => (
            <Tile key={p.publicId} index={i}>
              <PaintingCard p={p} />
            </Tile>
          ))}
        </Mosaic>
      )}
    </>
  );
}
