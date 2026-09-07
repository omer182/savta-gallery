"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The tile link, with the two-step tap for touch screens.
 *
 * On a phone there is no hover, so a placard has to be either always on — which
 * covers a corner of every painting on the wall — or asked for. This asks: the
 * first tap reveals the label, the second opens the painting. The gallery sits
 * at rest as nothing but paint.
 *
 * It stays a real <a href> throughout (PLAN.md §2): server-rendered with no
 * interception, so it is crawlable, cmd-clickable, and still navigates on the
 * first click for a crawler, a keyboard, or a browser where this script never
 * arrives. The interception is added only once the client confirms there is no
 * hover to rely on.
 */
export function CardLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const [revealed, setRevealed] = useState(false);
  const ref = useRef<HTMLAnchorElement>(null);

  // A tap anywhere else puts the label away again, so at most one is ever
  // showing. pointerdown rather than click: it lands before the next tile's
  // own click, which would otherwise be undone by this.
  useEffect(() => {
    if (!revealed) return;

    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setRevealed(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [revealed]);

  return (
    <Link
      ref={ref}
      href={href}
      className={className}
      data-revealed={revealed ? "" : undefined}
      onClick={(e) => {
        // Already asked for — this tap is the one that opens the painting.
        if (revealed) return;
        // On a mouse the label is already showing on hover, so the first click
        // must navigate exactly as it always did.
        if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
        // A modified click is the user asking for a new tab, never a reveal.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

        e.preventDefault();
        setRevealed(true);
      }}
    >
      {children}
    </Link>
  );
}
