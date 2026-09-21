"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CardView } from "@/lib/cardView";
import s from "./gallery.module.css";
import { Mosaic, Tile } from "./Mosaic";
import { PaintingCard } from "./PaintingCard";

/**
 * The gallery wall, extending as it is scrolled.
 *
 * The first page arrives server-rendered, so the gallery is complete HTML for
 * a crawler and for a visitor whose script never runs; further pages are
 * fetched and appended. Each new painting fades up as it comes into view under
 * the same reveal every other tile uses - see .card in gallery.module.css.
 *
 * The pager link underneath is a real href to the next page and always has
 * been. Script simply intercepts it: without one it still walks the gallery a
 * page at a time, and if the observer ever misses, it is there to tap.
 */
export function GalleryFeed({
  initialItems,
  initialHasMore,
  initialPage,
  tag,
}: {
  initialItems: CardView[];
  initialHasMore: boolean;
  initialPage: number;
  tag?: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setFailed(false);
    try {
      const next = page + 1;
      const qs = new URLSearchParams({ page: String(next) });
      if (tag) qs.set("tag", tag);

      const res = await fetch(`/api/gallery?${qs}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { items: CardView[]; hasMore: boolean };

      setItems((prev) => {
        // A painting published while she is scrolling shifts the offsets, which
        // can hand back a row that is already on the wall. Dropping it here is
        // cheaper than a duplicate key and a paining shown twice.
        const seen = new Set(prev.map((p) => p.publicId));
        return [...prev, ...data.items.filter((p) => !seen.has(p.publicId))];
      });
      setPage(next);
      setHasMore(data.hasMore);
    } catch {
      // Offline, or the server said no. Stop observing and leave the pager
      // link in place so it can be retried deliberately.
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, page, tag]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || failed) return;

    // Well before the bottom, so the next paintings are usually already there.
    // root is the viewport: content clipped by .shellScroll counts as out of
    // view, which is exactly the behaviour wanted.
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, failed, loadMore]);

  const nextHref = `/gallery?${tag ? `tag=${encodeURIComponent(tag)}&` : ""}page=${page + 1}`;

  return (
    <>
      <Mosaic>
        {items.map((p, i) => (
          <Tile key={p.publicId} index={i}>
            <PaintingCard p={p} priority={i < 4} />
          </Tile>
        ))}
      </Mosaic>

      {hasMore && !failed && <div ref={sentinel} className={s.sentinel} aria-hidden="true" />}

      {hasMore && (
        <div className={s.more} aria-live="polite">
          {loading ? (
            <span className={s.moreNote}>טוען עוד ציורים…</span>
          ) : (
            <Link
              className={s.moreLink}
              href={nextHref}
              onClick={(e) => {
                e.preventDefault();
                void loadMore();
              }}
            >
              {failed ? "לא הצלחנו לטעון. נסו שוב" : "עוד ציורים"}
            </Link>
          )}
        </div>
      )}
    </>
  );
}
