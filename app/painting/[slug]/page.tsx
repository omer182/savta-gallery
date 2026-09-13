import type { Metadata } from "next";
import Link from "next/link";
import { permanentRedirect } from "next/navigation";
import { notFound } from "next/navigation";
import { asc, isNotNull } from "drizzle-orm";
import { PaintingEditor } from "@/app/admin/paintings/[id]/PaintingEditor";
import { db, paintings as paintingsTable, tags as tagsTable } from "@/db";
import { BlurImage } from "@/components/BlurImage";
import { InlineAdmin } from "@/components/InlineAdmin";
import { getSession } from "@/lib/auth";
import g from "@/components/gallery.module.css";
import { Placard } from "@/components/Placard";
import { PublicShell } from "@/components/PublicShell";
import { fallbackUrl, srcSet } from "@/lib/imageUrls";
import { getImages, getPaintingByPublicId, getTagsFor, neighbours } from "@/lib/queries";
import { paintingHref, paintingSlug, publicIdFromSlug } from "@/lib/slug";
import { thumbhashDataUrl } from "@/lib/thumb";
import s from "./page.module.css";

/**
 * Must never be cached: this page now renders admin-only content, including the
 * PRIVATE provenance field (§5). A cached copy produced for an admin could
 * otherwise be served to an anonymous visitor. Reading cookies already forces
 * dynamic rendering, but that is too important to leave implicit.
 */
export const dynamic = "force-dynamic";

/** A stray "%" in a title would make decodeURIComponent throw. */
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function load(slugParam: string, includeUnpublished = false) {
  const publicId = publicIdFromSlug(slugParam);
  const painting = getPaintingByPublicId(publicId, includeUnpublished);
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
  const session = await getSession();
  const isAdmin = session?.role === "admin";

  // An admin may open an unpublished painting here — otherwise unpublishing
  // from this page would 404 it out from under them on the very next render.
  const { painting } = load(slug, isAdmin);
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

  // One painting, one photograph (PLAN.md §5) - there is no gallery of angles
  // to page through, so the work simply fills the frame.
  const primary = imgs.find((i) => i.isPrimary) ?? imgs[0];
  const ratio =
    painting.widthCm && painting.heightCm ? painting.heightCm / painting.widthCm : 1;

  const paragraphs = (painting.story ?? "").split(/\n{2,}/).filter((p) => p.trim());

  // Only queried for the admin panel, so a visitor's render does no extra work.
  const allTags = isAdmin
    ? db.select({ name: tagsTable.name }).from(tagsTable).orderBy(asc(tagsTable.name)).all()
    : [];
  const allMedia = isAdmin
    ? Array.from(
        new Set([
          "שמן על בד",
          "שמן על לוח",
          "אקוורל",
          "רישום",
          ...db
            .selectDistinct({ medium: paintingsTable.medium })
            .from(paintingsTable)
            .where(isNotNull(paintingsTable.medium))
            .all()
            .map((m) => m.medium)
            .filter((m): m is string => !!m),
        ]),
      )
    : [];

  return (
    <PublicShell current="">
      <div className={g.wrap}>
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

          {isAdmin && (
            <InlineAdmin status={painting.status}>
              <PaintingEditor
                painting={{
                  id: painting.id,
                  title: painting.title,
                  year: painting.year,
                  medium: painting.medium,
                  widthCm: painting.widthCm,
                  heightCm: painting.heightCm,
                  story: painting.story,
                  status: painting.status,
                  provenance: painting.provenance,
                }}
                tagNames={tags.map((t) => t.name)}
                allTags={allTags.map((t) => t.name)}
                allMedia={allMedia}
              />
            </InlineAdmin>
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
      </div>
    </PublicShell>
  );
}
