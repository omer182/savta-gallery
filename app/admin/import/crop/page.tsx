import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { db, images, paintings } from "@/db";
import { detectPaintingRect } from "@/lib/detectCrop";
import a from "../../admin.module.css";
import { AdminNav } from "../../AdminNav";
import { CropSheet, type CropItem } from "./CropSheet";

export const dynamic = "force-dynamic";
export const metadata = { title: "חיתוך" };

const BATCH = 40;

/**
 * Crop pass — a confidence-sorted contact sheet (PLAN.md §11).
 *
 * Deliberately separate from the story pass: a crop is a one-second glance that
 * is right ~90% of the time, a transcript is a two-minute listen. Merging them
 * would make bulk approval impossible.
 */
export default async function CropPass() {
  const rows = db
    .select({
      paintingId: paintings.id,
      title: paintings.title,
      imageId: images.id,
      originalPath: images.originalPath,
    })
    .from(paintings)
    .innerJoin(images, and(eq(images.paintingId, paintings.id), eq(images.isPrimary, true)))
    .where(eq(paintings.needsCrop, true))
    .orderBy(asc(paintings.id))
    .limit(BATCH)
    .all();

  // Detection runs server-side; the sheet only renders the proposal.
  const items: CropItem[] = [];
  for (const r of rows) {
    const det = await detectPaintingRect(r.originalPath);
    items.push({
      paintingId: r.paintingId,
      imageId: r.imageId,
      title: r.title,
      // Originals are admin-gated in the image route: they still show the wall
      // and the numbered sticky note.
      src: `/images/originals/${r.originalPath}`,
      rect: det?.rect ?? null,
      confidence: det?.confidence ?? 0,
      fullWidth: det?.fullWidth ?? 0,
      fullHeight: det?.fullHeight ?? 0,
    });
  }

  // Lowest confidence first, so the problems are at the top where they get seen.
  items.sort((x, y) => x.confidence - y.confidence);

  return (
    <main className={`${a.shell} ${a.wide}`}>
      <AdminNav />
      <h1 className={a.h1}>חיתוך</h1>
      <p className={a.lede}>
        {items.length === 0
          ? "אין ציורים שממתינים לחיתוך."
          : `${items.length} ציורים. הפחות בטוחים מופיעים ראשונים — תקנו אותם, ואשרו את השאר.`}
      </p>

      {items.length === 0 ? (
        <div className={a.note}>
          <Link href="/admin/import/stories">מעבר לסיפורים</Link>
        </div>
      ) : (
        <CropSheet items={items} />
      )}
    </main>
  );
}
