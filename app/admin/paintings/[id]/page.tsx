import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, paintings, tags } from "@/db";
import { fallbackUrl } from "@/lib/imageUrls";
import { getImages, getTagsFor } from "@/lib/queries";
import { paintingHref } from "@/lib/slug";
import a from "../../admin.module.css";
import { AdminNav } from "../../AdminNav";
import { PaintingEditor } from "./PaintingEditor";

export const dynamic = "force-dynamic";

export default async function EditPainting({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const [painting] = db.select().from(paintings).where(eq(paintings.id, id)).limit(1).all();
  if (!painting) notFound();

  const imgs = getImages(painting.id);
  const tagNames = getTagsFor(painting.id).map((t) => t.name);
  const allTags = db.select({ name: tags.name }).from(tags).orderBy(asc(tags.name)).all();

  const failed = imgs.filter((i) => i.processingStatus === "failed");

  return (
    <main className={a.shell}>
      <AdminNav />
      <h1 className={a.h1} dir="auto">
        {painting.title}
      </h1>
      <p className={a.lede}>
        <Link href={paintingHref(painting.publicId, painting.title)}>הצגה באתר</Link>
      </p>

      {imgs.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 26 }}>
          {imgs.map((im) => (
            <div key={im.id} className={a.listThumb} style={{ width: 88, flex: "0 0 88px" }}>
              {im.derivedHash ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fallbackUrl(im.derivedHash)} alt="" style={{ display: "block", width: "100%" }} />
              ) : (
                <div style={{ aspectRatio: "1", background: "#efe9dc", fontSize: 10, padding: 4, color: "var(--muted)" }}>
                  {im.processingStatus === "failed" ? "שגיאה" : "מעבד…"}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {failed.length > 0 && (
        <div className={`${a.note} ${a.error}`}>
          {failed.length} תמונות נכשלו בעיבוד: {failed[0]!.processingError}
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
      />
    </main>
  );
}
