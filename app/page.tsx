import Link from "next/link";
import s from "@/components/gallery.module.css";
import { Masonry, Reveal } from "@/components/Masonry";
import { PaintingCard } from "@/components/PaintingCard";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { toCardView } from "@/lib/cardView";
import { countPublished, listPublished, listTagsInUse } from "@/lib/queries";

// Database-backed, so it must not freeze at build time. Publishing calls
// revalidatePath("/"), which is what makes this cheap behind Cloudflare.
export const revalidate = 3600;

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
    <>
      <SiteHeader current="gallery" count={total} />
      <main className={s.wrap}>
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
      </main>
      <SiteFooter />
    </>
  );
}
