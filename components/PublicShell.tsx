import type { ReactNode } from "react";
import s from "./gallery.module.css";
import { SiteFooter, SiteHeader } from "./SiteHeader";

/**
 * Fixed chrome, scrolling content.
 *
 * The header (artist name + nav) and the footer stay on screen; only the
 * middle scrolls. Every public page uses this, so the frame never jumps
 * between the gallery and a painting.
 */
export function PublicShell({
  current,
  count,
  children,
}: {
  current?: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <div className={s.shell}>
      <div className={s.shellHead}>
        <SiteHeader current={current} count={count} />
      </div>
      <main className={s.shellScroll}>{children}</main>
      <SiteFooter />
    </div>
  );
}
