"use client";

import { useEffect, useState } from "react";
import s from "@/app/landing.module.css";

export type Plate = {
  key: string;
  avif: string | null;
  webp: string | null;
  fallback: string;
};

/** How long each painting holds before the next one comes up. */
const HOLD_MS = 7000;

/**
 * The paintings behind the front door.
 *
 * A slow crossfade through a handful of her work, chosen at random on the
 * server so the door looks different each time it is opened. Heavily veiled in
 * CSS — the point is a wash of her colour that keeps changing, not a slideshow
 * competing with the one thing on the page that matters, which is the way in.
 *
 * Every plate is in the DOM from the start and only opacity moves, so a
 * transition never waits on a download and nothing pops in half-loaded.
 *
 * Under reduced motion it does not cycle at all: the first painting simply
 * stays. That is a still page, not a broken one.
 */
export function HeroBackdrop({ plates }: { plates: Plate[] }) {
  const [at, setAt] = useState(0);

  useEffect(() => {
    if (plates.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = setInterval(() => setAt((v) => (v + 1) % plates.length), HOLD_MS);
    return () => clearInterval(id);
  }, [plates.length]);

  return (
    <div className={s.backdrop} aria-hidden="true">
      {plates.map((p, i) => (
        <picture key={p.key} className={`${s.plate} ${i === at ? s.plateOn : ""}`}>
          {p.avif && <source type="image/avif" srcSet={p.avif} sizes="100vw" />}
          {p.webp && <source type="image/webp" srcSet={p.webp} sizes="100vw" />}
          <img src={p.fallback} alt="" decoding="async" />
        </picture>
      ))}
      {/*
        The veil. Heaviest where the words sit and lightest at the edges, so
        the painting is visible as colour around the outside while the reading
        area stays close to paper and the ink keeps its contrast whatever the
        painting underneath happens to be.
      */}
      <div className={s.veil} />
    </div>
  );
}
