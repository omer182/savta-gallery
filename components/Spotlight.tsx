"use client";

import { useEffect } from "react";

/**
 * The room light.
 *
 * Writes the pointer position to --mx/--my; the gradient itself lives in CSS
 * (.shell::before), so this ships no styling and cannot make the wall
 * disappear if it fails.
 *
 * The properties go on <html> rather than on the shell, because custom
 * properties inherit - which means no ref, and PublicShell stays a server
 * component. The shell fills the viewport, so viewport percentages and shell
 * percentages are the same number.
 *
 * Coalesced to one write per frame: a pointermove handler that touches style on
 * every event is the classic way to make a page stutter, and this one sits
 * under a grid of several hundred images.
 *
 * Does nothing without a fine pointer or under reduced motion - the CSS falls
 * back to an even wash in both cases.
 */
export function Spotlight() {
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const root = document.documentElement;
    let frame = 0;
    let x = 0;
    let y = 0;

    const paint = () => {
      frame = 0;
      root.style.setProperty("--mx", `${(x / window.innerWidth) * 100}%`);
      root.style.setProperty("--my", `${(y / window.innerHeight) * 100}%`);
    };

    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
      root.style.removeProperty("--mx");
      root.style.removeProperty("--my");
    };
  }, []);

  return null;
}
