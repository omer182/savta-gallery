"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CardView } from "@/lib/cardView";
import s from "./gallery.module.css";
import { Mosaic, Tile } from "./Mosaic";
import { PaintingCard } from "./PaintingCard";
import { useSearchPanel } from "./SearchPanel";

/**
 * Search, in place on the gallery.
 *
 * The field opens above the tag strip on the page you are already on; tapping
 * חיפוש again closes it and the wall is exactly where it was left.
 *
 * It stays mounted when closed so both directions can animate - the wrapper
 * collapses with a 0fr/1fr grid row rather than a height, which is what lets
 * it transition without anyone having to know how tall it is. `inert` keeps
 * the collapsed field out of the tab order and the accessibility tree, which
 * a zero-height box would not do on its own.
 *
 * The tag strip stays visible while searching. It is the other way into the
 * archive, and hiding it the moment the field opens would make the two read
 * as alternatives rather than two ways of narrowing the same wall.
 */
export function GallerySearch({
  initialQuery = "",
  tags,
  children,
}: {
  initialQuery?: string;
  tags: ReactNode;
  /** The wall, shown whenever the field is empty. */
  children: ReactNode;
}) {
  const { open, close } = useSearchPanel();
  const [q, setQ] = useState(initialQuery);
  const [items, setItems] = useState<CardView[] | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
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
  }, [q]);

  /*
   * Closing puts the wall back without touching the query: results are gated
   * on `open`, so nothing stale can filter the gallery behind a shut field.
   * Reopening therefore resumes the last search rather than starting over,
   * which is the friendlier of the two behaviours and costs no extra state.
   */
  const showResults = open && items !== null;

  return (
    <>
      <div
        id="gallery-search"
        className={`${s.searchWrap} ${open ? s.searchOpen : ""}`}
        inert={!open}
      >
        <div className={s.searchInner}>
          <div className={s.searchField}>
            <svg
              className={s.searchIcon}
              viewBox="0 0 20 20"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <circle cx="8.75" cy="8.75" r="5.25" />
              <path d="M12.6 12.6 17 17" strokeLinecap="round" />
            </svg>

            <input
              ref={inputRef}
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") close();
              }}
              placeholder="חיפוש לפי שם, סיפור או תגית…"
              aria-label="חיפוש ציורים"
              /*
               * dir="rtl", not dir="auto". An empty field has no strong
               * character for auto to read, so it falls back to LTR and parks
               * the Hebrew placeholder against the left edge - at the one
               * moment the placeholder is the only thing there to see.
               */
              dir="rtl"
              autoComplete="off"
              spellCheck={false}
            />

            {/* Only ever a count, never an instruction: the placeholder has
                already said what the field is for. */}
            {q.trim() && (
              <span className={s.searchCount} role="status" aria-live="polite">
                {loading ? "מחפש…" : items === null ? "" : `${items.length}`}
              </span>
            )}

            {q && (
              <button
                type="button"
                className={s.searchClear}
                onClick={() => {
                  setQ("");
                  inputRef.current?.focus();
                }}
                aria-label="ניקוי החיפוש"
              >
                <svg
                  viewBox="0 0 20 20"
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {tags}

      {!showResults ? (
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
