import type { Metadata } from "next";
import Link from "next/link";
import { permanentRedirect } from "next/navigation";
import { notFound } from "next/navigation";
import { BlurImage } from "@/components/BlurImage";
import g from "@/components/gallery.module.css";
import { Placard } from "@/components/Placard";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { fallbackUrl, srcSet } from "@/lib/imageUrls";
import { getImages, getPaintingByPublicId, getTagsFor, neighbours } from "@/lib/queries";
import { paintingHref, paintingSlug, publicIdFromSlug } from "@/lib/slug";
import { thumbhashDataUrl } from "@/lib/thumb";
import s from "./page.module.css";

export const revalidate = 3600;

/** A stray "%" in a title would make decodeURIComponent throw. */
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function load(slugParam: string) {
  const publicId = publicIdFromSlug(slugParam);
  const painting = getPaintingByPublicId(publicId);
  return { publicId, painting };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { painting } = load(slug);
  if (!painting) return {};

  const imgs = getImages(painting.id);
  const primary = imgs.find((i) => i.isPrimary && i.derivedHash) ?? imgs.find((i) => i.derivedHash);

  return {
    title: painting.title,
    description: painting.story?.slice(0, 200) ?? undefined,
    openGraph: {
      title: painting.title,
      description: painting.story?.slice(0, 200) ?? undefined,
      images: primary?.derivedHash ? [fallbackUrl(primary.derivedHash)] : undefined,
    },
  };
}

export default async function PaintingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { painting } = load(slug);
  if (!painting) notFound();

  // The Hebrew tail is cosmetic; the id is the identity. A stale or missing tail
  // still resolves, then canonical-redirects to the current form (PLAN.md §12).
  //
  // The redirect target MUST be percent-encoded: a Location header may only
  // contain ASCII, and a raw Hebrew slug throws ERR_INVALID_CHAR and 500s the
  // page. Only the tail is encoded — encoding the whole path would eat the "/".
  const canonical = paintingSlug(painting.publicId, painting.title);
  if (safeDecode(slug) !== canonical) {
    permanentRedirect(`/painting/${encodeURIComponent(canonical)}`);
  }

  const imgs = getImages(painting.id);
  const tags = getTagsFor(painting.id);
  const { prev, next } = neighbours(painting.sortOrder, painting.id);

  const primary = imgs.find((i) => i.isPrimary) ?? imgs[0];
  const others = imgs.filter((i) => i.id !== primary?.id);
  const ratio =
    painting.widthCm && painting.heightCm ? painting.heightCm / painting.widthCm : 1;

  const paragraphs = (painting.story ?? "").split(/\n{2,}/).filter((p) => p.trim());

  return (
    <>
      <SiteHeader />
      <main className={g.wrap}>
        <div className={s.detail}>
          <Link className={s.back} href="/">
            → חזרה לגלריה
          </Link>

          <div className={s.top}>
            <div className={s.art}>
              <div className={s.heroFrame}>
                <BlurImage
                  alt={painting.title}
                  avif={
                    primary?.derivedHash && primary.width
                      ? srcSet(primary.derivedHash, primary.width, "avif")
                      : null
                  }
                  webp={
                    primary?.derivedHash && primary.width
                      ? srcSet(primary.derivedHash, primary.width, "webp")
                      : null
                  }
                  fallback={primary?.derivedHash ? fallbackUrl(primary.derivedHash) : null}
                  placeholder={thumbhashDataUrl(primary?.thumbhash)}
                  width={primary?.width ?? null}
                  height={primary?.height ?? null}
                  ratio={ratio}
                  sizes="(min-width: 900px) 760px, 100vw"
                  priority
                />
              </div>

              {others.length > 0 && (
                <div className={s.thumbs}>
                  <div className={`${s.thumb} ${s.thumbOn}`}>
                    <BlurImage
                      alt=""
                      fallback={primary?.derivedHash ? fallbackUrl(primary.derivedHash) : null}
                      placeholder={thumbhashDataUrl(primary?.thumbhash)}
                      width={primary?.width ?? null}
                      height={primary?.height ?? null}
                      ratio={ratio}
                    />
                  </div>
                  {others.map((im) => (
                    <div key={im.id} className={s.thumb}>
                      <BlurImage
                        alt=""
                        fallback={im.derivedHash ? fallbackUrl(im.derivedHash) : null}
                        placeholder={thumbhashDataUrl(im.thumbhash)}
                        width={im.width}
                        height={im.height}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={s.side}>
              <Placard
                title={painting.title}
                year={painting.year}
                medium={painting.medium}
                widthCm={painting.widthCm}
                heightCm={painting.heightCm}
                variant="plain"
                large
              />
              {tags.length > 0 && (
                <div className={s.taglist}>
                  {tags.map((t) => (
                    <Link key={t.slug} href={`/?tag=${encodeURIComponent(t.slug)}`}>
                      {t.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {paragraphs.length > 0 && (
            <div className={s.story}>
              {paragraphs.map((p, i) => (
                <p key={i} dir="auto">
                  {p}
                </p>
              ))}
            </div>
          )}

          <div className={s.pager}>
            {prev ? (
              <Link href={paintingHref(prev.publicId, prev.title)} dir="auto">
                {prev.title} →
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={paintingHref(next.publicId, next.title)} dir="auto">
                ← {next.title}
              </Link>
            ) : (
              <span />
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
