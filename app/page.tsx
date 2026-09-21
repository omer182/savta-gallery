import Link from "next/link";
import { HeroBackdrop, type Plate } from "@/components/HeroBackdrop";
import { ARTIST_NAME } from "@/components/SiteHeader";
import { getSession } from "@/lib/auth";
import { fallbackUrl, srcSet } from "@/lib/imageUrls";
import { countPublished, randomPublished } from "@/lib/queries";
import { APP_VERSION } from "@/lib/version";
import s from "./landing.module.css";

/**
 * The front door.
 *
 * The gallery is fifty years of work; opening straight onto five hundred
 * paintings gives a visitor nowhere to stand. This is the pause before that —
 * her name, how much there is, and one way in. Deliberately nothing else: a
 * door with a paragraph on it is not a door.
 *
 * Never prerendered, for the same two reasons every public page is dynamic:
 * the session is read here, and a prerender would run its queries at BUILD
 * time, where there is no database. The archive must never be a build
 * dependency. It also means the paintings behind are re-drawn per visit.
 */
export const dynamic = "force-dynamic";

export default async function Landing() {
  const session = await getSession();
  const total = countPublished();

  const plates: Plate[] = randomPublished(6)
    .filter((p) => p.derivedHash)
    .map((p) => ({
      key: p.publicId,
      avif: p.derivedHash && p.imgWidth ? srcSet(p.derivedHash, p.imgWidth, "avif") : null,
      webp: p.derivedHash && p.imgWidth ? srcSet(p.derivedHash, p.imgWidth, "webp") : null,
      fallback: fallbackUrl(p.derivedHash!),
    }));

  return (
    <div className={s.door}>
      <HeroBackdrop plates={plates} />

      {/* Her name and one way in. Nothing else earns a place on a door. */}
      <main className={s.stage}>
        <h1 className={s.name}>{ARTIST_NAME}</h1>

        <div className={s.actions}>
          <Link className={s.cta} href="/gallery">
            <span>כניסה לגלריה</span>
            <span className={s.arrow} aria-hidden="true">
              ←
            </span>
          </Link>
        </div>

        {total > 0 && (
          <p className={s.count}>
            {total} {total === 1 ? "ציור בארכיון" : "ציורים בארכיון"}
          </p>
        )}
      </main>

      <footer className={s.foot}>
        <span className={s.footMain}>
          © {new Date().getFullYear()} {ARTIST_NAME}
          {!session && (
            <>
              {" · "}
              <Link href="/login" className={s.footLink}>
                כניסה
              </Link>
            </>
          )}
        </span>
        <span className={s.version} dir="ltr" title="גרסה">
          {APP_VERSION}
        </span>
      </footer>
    </div>
  );
}
