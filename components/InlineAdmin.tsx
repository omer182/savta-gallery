"use client";

import { type ReactNode, useState } from "react";
import s from "./InlineAdmin.module.css";

/**
 * Admin editing folded into the public painting page, so a painting can be
 * corrected or unpublished where it is being looked at rather than by hunting
 * for it again in the admin list.
 *
 * Collapsed by default: the page's job is still to show the painting, and the
 * editor should not push her story down the screen until it is wanted.
 */
export function InlineAdmin({
  status,
  children,
}: {
  status: "draft" | "published" | "hidden";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const label = {
    draft: "טיוטה — לא מופיע באתר",
    published: "מפורסם",
    hidden: "מוסתר — הוסר מהאתר",
  }[status];

  return (
    <section className={s.wrap} aria-label="עריכה">
      <div className={s.bar}>
        <span className={`${s.state} ${status !== "published" ? s.stateOff : ""}`}>{label}</span>
        <button type="button" className={s.toggle} onClick={() => setOpen((v) => !v)}>
          {open ? "סגירת העריכה" : "עריכה"}
        </button>
      </div>
      {open && <div className={s.body}>{children}</div>}
    </section>
  );
}
