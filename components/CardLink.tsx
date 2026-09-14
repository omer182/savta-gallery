"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** The name both ends of the morph share. Must be unique per document. */
const VT_NAME = "painting";

/** How long the frozen old frame may be held before the morph is abandoned. */
const VT_TIMEOUT_MS = 900;

type ViewTransitionDocument = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => { finished: Promise<void> };
};

/**
 * Resolves once the painting page has actually rendered its hero.
 *
 * A view transition holds a frozen snapshot of the old page until its callback
 * settles, and router.push gives no signal for "the new route is on screen".
 * Watching for the hero is that signal. The cap matters more than the watch: a
 * slow fetch must degrade to an ordinary navigation rather than freezing the
 * gallery, so past the deadline we resolve regardless and the browser
 * cross-fades whatever is there.
 */
function waitForHero(): Promise<void> {
  return new Promise((resolve) => {
    const started = performance.now();
    const tick = () => {
      if (document.querySelector("[data-vt-hero]")) return resolve();
      if (performance.now() - started > VT_TIMEOUT_MS) return resolve();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/**
 * The tile link: a two-step tap on touch, and a shared-element morph into the
 * painting page.
 *
 * THE MORPH. Clicking a painting animates that tile into the full work rather
 * than cutting to a new page - the same object, larger, which is what walking
 * up to a painting does. The tile's image is given a view-transition-name for
 * the length of the navigation and the painting page carries the same name on
 * its hero, so the browser tweens between them.
 *
 * THE TWO-STEP TAP. A phone has no hover, so a placard would otherwise have to
 * sit permanently over a corner of every painting. The first tap reveals the
 * label, the second opens the work.
 *
 * It stays a real <a href> throughout (PLAN.md §2): server-rendered with no
 * interception, so it is crawlable, cmd-clickable, and still navigates on the
 * first click for a crawler, a keyboard, or a browser where this script never
 * arrives. Everything here is added only once the client is running, and every
 * enhancement falls back to plain navigation.
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
  const router = useRouter();
  const [revealed, setRevealed] = useState(false);
  const ref = useRef<HTMLAnchorElement>(null);
  const prefetched = useRef(false);

  // A tap anywhere else puts the label away again, so at most one is ever
  // showing. pointerdown rather than click: it lands before the next tile's own
  // click, which would otherwise be undone by this.
  useEffect(() => {
    if (!revealed) return;
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setRevealed(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [revealed]);

  /*
   * Warm the route on approach, not on render. Prefetching 48 dynamic pages
   * because they scrolled into view would hammer the server for paintings
   * nobody opens; by the time a pointer has reached a tile the odds are very
   * different, and the fetch is usually done before the click lands - which is
   * what keeps the morph from stalling.
   */
  const warm = () => {
    if (prefetched.current) return;
    prefetched.current = true;
    router.prefetch(href);
  };

  /*
   * Takes the anchor from the click rather than reading it back off the ref.
   * The ref is claimed by the dismiss effect above, and reaching through it to
   * mutate a child is exactly the aliasing the compiler refuses to reason
   * about - currentTarget is the same element and owes nothing to React state.
   */
  const go = (anchor: HTMLAnchorElement) => {
    const doc = document as ViewTransitionDocument;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!doc.startViewTransition || reduce) {
      router.push(href);
      return;
    }

    // The anchor IS the painting's box, and the hero on the other side is its
    // frame - naming the same box at both ends is what makes the tween read as
    // one object growing rather than two pictures swapping.
    anchor.style.viewTransitionName = VT_NAME;

    const transition = doc.startViewTransition(() => {
      router.push(href);
      return waitForHero();
    });

    // Release the name whatever happens. Two elements sharing it would break
    // the next transition outright.
    transition.finished.catch(() => {}).finally(() => {
      anchor.style.viewTransitionName = "";
    });
  };

  return (
    <Link
      ref={ref}
      href={href}
      className={className}
      data-revealed={revealed ? "" : undefined}
      onPointerEnter={warm}
      onTouchStart={warm}
      onFocus={warm}
      onClick={(e) => {
        // A modified click is the user asking for a new tab, never a reveal.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

        const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
        // On touch the first tap only asks for the label.
        if (!fine && !revealed) {
          e.preventDefault();
          setRevealed(true);
          return;
        }

        // Captured synchronously: currentTarget is not safe to read later.
        const anchor = e.currentTarget;
        e.preventDefault();
        go(anchor);
      }}
    >
      {children}
    </Link>
  );
}
