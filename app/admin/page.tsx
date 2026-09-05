import { and, desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { db, images, paintings } from "@/db";
import { fallbackUrl } from "@/lib/imageUrls";
import { sweepOrphanImages } from "@/lib/mutations";
import a from "./admin.module.css";
import { AdminNav } from "./AdminNav";

export const dynamic = "force-dynamic";
export const metadata = { title: "ניהול" };

const STATUS_LABEL = { draft: "טיוטה", published: "מפורסם", hidden: "מוסתר" } as const;
const STATUS_CLASS = {
  draft: a.badgeDraft,
  published: a.badgePublished,
  hidden: a.badgeHidden,
} as const;

export default async function AdminHome() {
  // Uploads abandoned mid-flow leave orphan rows; this is the only place that
  // notices, so it sweeps rather than relying on a cron.
  sweepOrphanImages();

  const rows = db
    .select({
      id: paintings.id,
      title: paintings.title,
      year: paintings.year,
      status: paintings.status,
      needsCrop: paintings.needsCrop,
      needsReview: paintings.needsReview,
      createdBy: paintings.createdBy,
      derivedHash: images.derivedHash,
      // Imported paintings have no derivative until the crop pass runs, so the
      // list needs the original to show anything at all. Originals are
      // admin-gated in the image route, and this page is admin-only.
      originalPath: images.originalPath,
    })
    .from(paintings)
    // Join the PRIMARY image specifically: an unqualified join let SQLite pick
    // an arbitrary frame, so a painting with several showed a random one.
    .leftJoin(images, and(eq(images.paintingId, paintings.id), eq(images.isPrimary, true)))
    .groupBy(paintings.id)
    .orderBy(desc(paintings.updatedAt))
    .limit(300)
    .all();

  const counts = db
    .select({ status: paintings.status, n: sql<number>`count(*)` })
    .from(paintings)
    .groupBy(paintings.status)
    .all();

  const drafts = counts.find((c) => c.status === "draft")?.n ?? 0;
  const pendingCrop = rows.filter((r) => r.needsCrop).length;
  const pendingStory = rows.filter((r) => r.needsReview).length;

  return (
    <main className={`${a.shell} ${a.wide}`}>
      <AdminNav />
      <h1 className={a.h1}>ניהול</h1>
      <p className={a.lede}>
        {drafts} טיוטות ממתינות
        {pendingCrop > 0 && ` · ${pendingCrop} ממתינים לחיתוך`}
        {pendingStory > 0 && ` · ${pendingStory} ממתינים לסיפור`}
      </p>

      {(pendingCrop > 0 || pendingStory > 0) && (
        <div className={a.note}>
          יש ייבוא שממתין לטיפול.{" "}
          {pendingCrop > 0 && <Link href="/admin/import/crop">מעבר לחיתוך</Link>}
          {pendingCrop > 0 && pendingStory > 0 && " · "}
          {pendingStory > 0 && <Link href="/admin/import/stories">מעבר לסיפורים</Link>}
        </div>
      )}

      <ul className={a.list}>
        {rows.map((p) => (
          <li key={p.id} className={a.listItem}>
            <Link href={`/admin/paintings/${p.id}`} className={a.listThumb}>
              {p.derivedHash ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fallbackUrl(p.derivedHash)}
                  alt=""
                  style={{ display: "block", width: "100%" }}
                />
              ) : p.originalPath ? (
                // Uncropped: still shows wall and sticky note, but it is what
                // tells one imported painting from another before the crop pass.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/images/originals/${p.originalPath}`}
                  alt=""
                  style={{ display: "block", width: "100%", opacity: 0.75 }}
                />
              ) : (
                <div style={{ aspectRatio: "1", background: "#efe9dc" }} />
              )}
            </Link>
            <div className={a.listMain}>
              <div className={a.listTitle} dir="auto">
                <Link href={`/admin/paintings/${p.id}`}>{p.title}</Link>
              </div>
              <div className={a.listMeta}>
                {p.year ?? "ללא שנה"} · נוצר על ידי {p.createdBy === "artist" ? "בלומה" : p.createdBy === "import" ? "ייבוא" : "מנהל"}
              </div>
            </div>
            {p.needsCrop && <span className={a.badge}>ממתין לחיתוך</span>}
            <span className={`${a.badge} ${STATUS_CLASS[p.status]}`}>{STATUS_LABEL[p.status]}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
