import type { ReactNode } from "react";
import s from "./gallery.module.css";
import { SiteFooter, SiteHeader } from "./SiteHeader";
import { Spotlight } from "./Spotlight";

/**
 * Fixed chrome, scrolling art.
 *
 * The header and footer stay on screen; only the middle scrolls. Every public
 * page uses this, so the room never jumps between the wall and a painting.
 *
 * `gallery-dark` is an unhashed global class on purpose. It carries the dark
 * palette (globals.css) and lets `body:has(.gallery-dark)` paint the iOS
 * rubber-band area behind the shell - a shared root layout cannot put a
 * per-route class on <html>, and a CSS-module name would be hashed out of
 * reach of that selector.
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
    <div className={`${s.shell} gallery-dark`}>
      <Spotlight />
      <div className={s.shellHead}>
        <SiteHeader current={current} count={count} />
      </div>
      <main className={s.shellScroll}>{children}</main>
      <SiteFooter />
    </div>
  );
}
