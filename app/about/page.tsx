import { eq } from "drizzle-orm";
import { db, images } from "@/db";
import { BlurImage } from "@/components/BlurImage";
import g from "@/components/gallery.module.css";
import { PublicShell } from "@/components/PublicShell";
import { fallbackUrl, srcSet } from "@/lib/imageUrls";
import { getPage } from "@/lib/queries";
import { thumbhashDataUrl } from "@/lib/thumb";
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

  const portrait = page?.portraitImageId
    ? (db.select().from(images).where(eq(images.id, page.portraitImageId)).get() ?? null)
    : null;

  return (
    <PublicShell current="about">
      <div className={g.wrap}>
        <div className={s.prose}>
          <h2>{page?.title ?? "אודות"}</h2>

          {/* The portrait sits in the same white frame as the paintings — she
              belongs on the wall with her work, not in a separate treatment. */}
          <figure className={s.portrait}>
            {portrait?.derivedHash ? (
              <div className={s.portraitFrame}>
                <BlurImage
                  alt="בלומה שוורצברג קמין"
                  avif={portrait.width ? srcSet(portrait.derivedHash, portrait.width, "avif") : null}
                  webp={portrait.width ? srcSet(portrait.derivedHash, portrait.width, "webp") : null}
                  fallback={fallbackUrl(portrait.derivedHash)}
                  placeholder={thumbhashDataUrl(portrait.thumbhash)}
                  width={portrait.width}
                  height={portrait.height}
                  sizes="(min-width: 700px) 300px, 60vw"
                  priority
                />
              </div>
            ) : (
              <div className={`${s.portraitFrame} ${s.portraitEmpty}`} aria-hidden="true">
                <span className={s.portraitMark}>ב</span>
              </div>
            )}
            <figcaption className={s.portraitCaption}>בלומה שוורצברג קמין</figcaption>
          </figure>

          {paragraphs.length ? (
            paragraphs.map((p, i) => (
              <p key={i} dir="auto">
                {p}
              </p>
            ))
          ) : (
            <p dir="auto">עוד לא נכתב כאן דבר.</p>
          )}
        </div>
      </div>
    </PublicShell>
  );
}
