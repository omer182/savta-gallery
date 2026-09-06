"use client";

import { useEffect, useRef, useState } from "react";
import g from "@/components/gallery.module.css";
import { Mosaic, Tile } from "@/components/Mosaic";
import { PaintingCard } from "@/components/PaintingCard";
import type { CardView } from "@/lib/cardView";
import s from "./page.module.css";

/**
 * Search is its own page, not an overlay (PLAN.md §1). Only the results block
 * re-renders as she types, so the field keeps focus and cursor position.
 */
export function SearchClient({ initialQuery }: { initialQuery: string }) {
  const [q, setQ] = useState(initialQuery);
  const [items, setItems] = useState<CardView[] | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const term = q.trim();
    const ac = new AbortController();

    // Everything happens inside the debounce, never synchronously in the effect
    // body: a fast typist would otherwise fire a request per keystroke and see
    // the spinner flash on every one. The abort also stops an earlier slow
    // response from overwriting a newer one.
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
        /* aborted or offline — keep the previous results on screen */
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [q]);

  // Keep the URL shareable without re-rendering the server component.
  useEffect(() => {
    const url = q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : "/search";
    window.history.replaceState(null, "", url);
  }, [q]);

  return (
    <div className={s.page}>
      <div className={s.bar}>
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="חיפוש לפי שם, סיפור או תגית…"
          aria-label="חיפוש ציורים"
          dir="auto"
        />
        <div className={s.count} role="status" aria-live="polite">
          {loading
            ? "מחפש…"
            : items === null
              ? ""
              : items.length === 1
                ? "תוצאה אחת"
                : `${items.length} תוצאות`}
        </div>
      </div>

      <div className={s.results}>
        {items === null ? (
          <div className={s.hint}>הקלידו כדי לחפש בציורים ובסיפורים.</div>
        ) : items.length === 0 ? (
          <div className={g.empty}>לא נמצאו ציורים. נסו מילה אחרת.</div>
        ) : (
          <Mosaic>
            {items.map((p, i) => (
              <Tile key={p.publicId} index={i} ratio={p.ratio}>
                <PaintingCard p={p} />
              </Tile>
            ))}
          </Mosaic>
        )}
      </div>
    </div>
  );
}
