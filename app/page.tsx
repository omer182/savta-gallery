import Link from "next/link";
import s from "@/components/gallery.module.css";
import { Masonry, Reveal } from "@/components/Masonry";
import { PaintingCard } from "@/components/PaintingCard";
import { PublicShell } from "@/components/PublicShell";
import { toCardView } from "@/lib/cardView";
import { countPublished, listPublished, listTagsInUse } from "@/lib/queries";

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

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const tag = sp.tag;
  const page = Math.max(1, Number(sp.page) || 1);

  const { items, hasMore } = listPublished({ tag, page });
  const allTags = listTagsInUse();
  const total = countPublished();

  const tagHref = (slug?: string) => (slug ? `/?tag=${encodeURIComponent(slug)}` : "/");

  return (
    <PublicShell current="gallery" count={total}>
      <div className={s.wrap}>
        <div className={s.tagbar}>
          <div className={s.tagscroll}>
            <Link href="/" className={`${s.tag} ${!tag ? s.tagOn : ""}`}>
              הכול
            </Link>
            {allTags.map((t) => (
              <Link
                key={t.slug}
                href={tagHref(t.slug)}
                className={`${s.tag} ${tag === t.slug ? s.tagOn : ""}`}
              >
                {t.name}
              </Link>
            ))}
          </div>
        </div>

        {items.length === 0 ? (
          <div className={s.empty}>אין כאן ציורים עדיין.</div>
        ) : (
          <>
            <Masonry>
              {items.map((p, i) => (
                <Reveal key={p.publicId} index={i}>
                  <PaintingCard p={toCardView(p)} priority={i < 4} />
                </Reveal>
              ))}
            </Masonry>
            {(hasMore || page > 1) && (
              <div className={s.more}>
                {page > 1 && (
                  <Link
                    className={s.moreLink}
                    href={`${tagHref(tag)}${tag ? "&" : "?"}page=${page - 1}`}
                  >
                    עמוד קודם
                  </Link>
                )}
                {hasMore && (
                  <Link
                    className={s.moreLink}
                    href={`${tagHref(tag)}${tag ? "&" : "?"}page=${page + 1}`}
                    style={{ marginInlineStart: page > 1 ? 24 : 0 }}
                  >
                    עוד ציורים
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </PublicShell>
  );
}
