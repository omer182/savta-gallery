import { and, asc, eq, notInArray } from "drizzle-orm";
import Link from "next/link";
import { db, images, paintings } from "@/db";
import { fallbackUrl } from "@/lib/imageUrls";
import a from "../../admin.module.css";
import { AdminNav } from "../../AdminNav";
import { StoryReview } from "./StoryReview";

export const dynamic = "force-dynamic";
export const metadata = { title: "סיפורים" };

/**
 * Story pass — sequential, one painting per screen (PLAN.md §11).
 *
 * Kept apart from the crop pass because it is slow and pleasant rather than
 * fast and mechanical. It only edits text, so it blocks nothing: the gallery can
 * go live after cropping, with stories filling in over weeks.
 */
export default async function StoriesPass({
  searchParams,
}: {
  searchParams: Promise<{ skip?: string }>;
}) {
  // "Come back to this later" must advance, not reload the same painting, so
  // deferred ids ride along in the URL for this sitting.
  const skip = ((await searchParams).skip ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  const pending = skip.length
    ? and(eq(paintings.needsReview, true), notInArray(paintings.id, skip))
    : eq(paintings.needsReview, true);

  const [row] = db
    .select({
      id: paintings.id,
      title: paintings.title,
      year: paintings.year,
      medium: paintings.medium,
      widthCm: paintings.widthCm,
      heightCm: paintings.heightCm,
      story: paintings.story,
      audioPath: paintings.audioPath,
    })
    .from(paintings)
    .where(pending)
    .orderBy(asc(paintings.id))
    .limit(1)
    .all();

  const remaining = db
    .select({ id: paintings.id })
    .from(paintings)
    .where(eq(paintings.needsReview, true))
    .all().length;

  if (!row) {
    return (
      <main className={a.shell}>
        <AdminNav />
        <h1 className={a.h1}>סיפורים</h1>
        <p className={a.lede}>אין ציורים שממתינים לסיפור.</p>
        <div className={a.note}>
          <Link href="/admin">חזרה לניהול</Link>
        </div>
      </main>
    );
  }

  const [img] = db
    .select({ derivedHash: images.derivedHash })
    .from(images)
    .where(and(eq(images.paintingId, row.id), eq(images.isPrimary, true)))
    .limit(1)
    .all();

  return (
    <main className={a.shell}>
      <AdminNav />
      <h1 className={a.h1}>סיפורים</h1>
      <p className={a.lede}>נותרו {remaining} ציורים.</p>
      <StoryReview
        painting={row}
        imageSrc={img?.derivedHash ? fallbackUrl(img.derivedHash) : null}
        audioSrc={row.audioPath ? `/api/import/audio?id=${row.id}` : null}
        skip={skip}
      />
    </main>
  );
}
