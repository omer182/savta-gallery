import g from "@/components/gallery.module.css";
import { PublicShell } from "@/components/PublicShell";
import { getPage } from "@/lib/queries";
import s from "./page.module.css";

/**
 * Never prerendered. Two reasons, and the second is load-bearing:
 *
 * 1. SiteHeader reads the session cookie, so this page's output already
 *    differs per visitor and must not be cached across them.
 * 2. A prerender runs its queries AT BUILD TIME, where there is no database —
 *    the container build has no /data — and the page dies with SQLITE_ERROR.
 *    The build must never depend on the archive existing.
 */
export const dynamic = "force-dynamic";

export const metadata = { title: "אודות" };

export default async function AboutPage() {
  const page = getPage("about");
  const paragraphs = (page?.body ?? "").split(/\n{2,}/).filter((p) => p.trim());

  return (
    <PublicShell current="about">
      <div className={g.wrap}>
        <div className={s.prose}>
          <h2>{page?.title ?? "אודות"}</h2>
          {paragraphs.length ? (
            paragraphs.map((p, i) => (
              <p key={i} dir="auto">
                {p}
              </p>
            ))
          ) : (
            <p dir="auto">עוד לא נכתב כאן דבר.</p>
          )}
          <p className={s.note}>(הדיוקן שלה ותצלומי הסטודיו יופיעו כאן.)</p>
        </div>
      </div>
    </PublicShell>
  );
}
