"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import s from "./gallery.module.css";

/**
 * Whether the search field is open.
 *
 * The toggle lives in the header and the field lives on the gallery, so the
 * two need somewhere to meet. A context in the shell is that place - and it
 * keeps opening and closing entirely client-side, which is the only way the
 * panel can animate shut. Driving it from the URL would make closing a
 * navigation, and a navigation cannot transition.
 */
type Panel = { open: boolean; toggle: () => void; close: () => void };

const Ctx = createContext<Panel>({ open: false, toggle: () => {}, close: () => {} });

export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  /*
   * Deep links still work: /search redirects here with ?search=1, and this
   * opens the panel after mount rather than during render. Opening on the
   * second frame is deliberate - it means the transition plays instead of the
   * field simply being there, and it keeps the server and client markup
   * identical so there is no hydration mismatch.
   */
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("search") === "1") {
      const id = requestAnimationFrame(() => setOpen(true));
      return () => cancelAnimationFrame(id);
    }
  }, []);

  const value = useMemo<Panel>(
    () => ({ open, toggle: () => setOpen((v) => !v), close: () => setOpen(false) }),
    [open],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSearchPanel() {
  return useContext(Ctx);
}

/**
 * The header's חיפוש item. A button, not a link: it opens and closes a panel
 * on the page you are already on, and dressing that up as navigation would be
 * a lie to anyone reading the status bar or using a screen reader.
 */
export function SearchToggle() {
  const { open, toggle } = useSearchPanel();

  return (
    <button
      type="button"
      className={`${s.navlink} ${open ? s.navOn : ""}`}
      onClick={toggle}
      aria-expanded={open}
      aria-controls="gallery-search"
    >
      חיפוש
    </button>
  );
}
