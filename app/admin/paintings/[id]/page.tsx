import { asc, eq, isNotNull } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, paintings, tags } from "@/db";
import { fallbackUrl } from "@/lib/imageUrls";
import { getImages, getTagsFor } from "@/lib/queries";
import { paintingHref } from "@/lib/slug";
import a from "../../admin.module.css";
import { AdminNav } from "../../AdminNav";
import { PaintingImage } from "./PaintingImage";
import { PaintingEditor } from "./PaintingEditor";

export const dynamic = "force-dynamic";

export default async function EditPainting({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const [painting] = db.select().from(paintings).where(eq(paintings.id, id)).limit(1).all();
  if (!painting) notFound();

  const imgs = getImages(painting.id);
  const tagNames = getTagsFor(painting.id).map((t) => t.name);
  const allTags = db.select({ name: tags.name }).from(tags).orderBy(asc(tags.name)).all();

  // Techniques already in use, so the chip list reflects her actual vocabulary.
  const usedMedia = db
    .selectDistinct({ medium: paintings.medium })
    .from(paintings)
    .where(isNotNull(paintings.medium))
    .all();
  const allMedia = Array.from(
    new Set([
      "שמן על בד",
      "שמן על לוח",
      "אקוורל",
      "רישום",
      ...usedMedia.map((m) => m.medium).filter((m): m is string => !!m),
    ]),
  );

  // One painting, one photograph (PLAN.md §5). getImages sorts the primary
  // first, so this is the painting's image, full stop.
  const primary = imgs.find((i) => i.isPrimary) ?? imgs[0];
  const failed = imgs.filter((i) => i.processingStatus === "failed");

  return (
    <main className={a.shell}>
      <AdminNav />
      <h1 className={a.h1} dir="auto">
        {painting.title}
      </h1>
      {/* The public page only serves published paintings, so this link would
          404 for a draft or a hidden one. */}
      {painting.status === "published" ? (
        <p className={a.lede}>
          <Link href={paintingHref(painting.publicId, painting.title)}>הצגה באתר</Link>
        </p>
      ) : (
        <p className={a.lede}>הציור אינו מופיע באתר כרגע.</p>
      )}

      {primary && (
        <PaintingImage
          paintingId={painting.id}
          imageId={primary.id}
          title={painting.title}
          /* Cropping always re-reads the ORIGINAL, so a new crop never stacks
             on top of an old one. */
          originalSrc={`/images/originals/${primary.originalPath}`}
          displaySrc={
            primary.derivedHash
              ? fallbackUrl(primary.derivedHash)
              : `/images/originals/${primary.originalPath}`
          }
          needsCrop={painting.needsCrop}
        />
      )}

      {painting.needsCrop && (
        <div className={a.note}>
          התמונה עדיין לא נחתכה — מה שמוצג כאן הוא הצילום המקורי, כולל הקיר והפתק.{" "}
          <Link href="/admin/import/crop">מעבר לחיתוך</Link>
        </div>
      )}

      {failed.length > 0 && (
        <div className={`${a.note} ${a.error}`}>
          עיבוד התמונה נכשל: {failed[0]!.processingError}
        </div>
      )}

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
        tagNames={tagNames}
        allTags={allTags.map((t) => t.name)}
        allMedia={allMedia}
      />
    </main>
  );
}
