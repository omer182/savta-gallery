import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db, images, pages, paintings, paintingTags, tags } from "@/db";

export const PAGE_SIZE = 48;

export type CardPainting = {
  id: number;
  publicId: string;
  title: string;
  year: number | null;
  medium: string | null;
  widthCm: number | null;
  heightCm: number | null;
  derivedHash: string | null;
  imgWidth: number | null;
  imgHeight: number | null;
  thumbhash: string | null;
};

/** Primary image joined in, so a grid render is one query rather than N+1. */
const cardColumns = {
  id: paintings.id,
  publicId: paintings.publicId,
  title: paintings.title,
  year: paintings.year,
  medium: paintings.medium,
  widthCm: paintings.widthCm,
  heightCm: paintings.heightCm,
  derivedHash: images.derivedHash,
  imgWidth: images.width,
  imgHeight: images.height,
  thumbhash: images.thumbhash,
};

const primaryImageJoin = and(eq(images.paintingId, paintings.id), eq(images.isPrimary, true));

export function listPublished({ tag, page = 1 }: { tag?: string; page?: number } = {}) {
  const offset = (page - 1) * PAGE_SIZE;

  const base = db
    .select(cardColumns)
    .from(paintings)
    .leftJoin(images, primaryImageJoin)
    .where(
      tag
        ? and(
            eq(paintings.status, "published"),
            inArray(
              paintings.id,
              db
                .select({ id: paintingTags.paintingId })
                .from(paintingTags)
                .innerJoin(tags, eq(tags.id, paintingTags.tagId))
                .where(eq(tags.slug, tag)),
            ),
          )
        : eq(paintings.status, "published"),
    )
    .orderBy(asc(paintings.sortOrder), desc(paintings.id))
    .limit(PAGE_SIZE + 1) // one extra row tells us whether another page exists
    .offset(offset);

  const rows = base.all() as CardPainting[];
  return { items: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE };
}

/**
 * A random handful of published work, for the front door.
 *
 * Random in SQL rather than by shuffling a full list in JS: the archive runs
 * to ~500 rows and the landing page needs six of them. Rows without a
 * processed image are excluded outright - a blank plate in a slideshow is
 * worse than a shorter slideshow.
 */
export function randomPublished(n = 6) {
  return db
    .select(cardColumns)
    .from(paintings)
    .leftJoin(images, primaryImageJoin)
    .where(and(eq(paintings.status, "published"), isNotNull(images.derivedHash)))
    .orderBy(sql`random()`)
    .limit(n)
    .all() as CardPainting[];
}

export function countPublished() {
  const [row] = db
    .select({ n: sql<number>`count(*)` })
    .from(paintings)
    .where(eq(paintings.status, "published"))
    .all();
  return row?.n ?? 0;
}

export function listTagsInUse() {
  return db
    .selectDistinct({ name: tags.name, slug: tags.slug })
    .from(tags)
    .innerJoin(paintingTags, eq(paintingTags.tagId, tags.id))
    .innerJoin(paintings, eq(paintings.id, paintingTags.paintingId))
    .where(eq(paintings.status, "published"))
    .orderBy(asc(tags.name))
    .all();
}

export function getPaintingByPublicId(publicId: string, includeUnpublished = false) {
  const [row] = db
    .select()
    .from(paintings)
    .where(
      includeUnpublished
        ? eq(paintings.publicId, publicId)
        : and(eq(paintings.publicId, publicId), eq(paintings.status, "published")),
    )
    .limit(1)
    .all();
  return row ?? null;
}

export function getImages(paintingId: number) {
  return db
    .select()
    .from(images)
    .where(eq(images.paintingId, paintingId))
    .orderBy(desc(images.isPrimary), asc(images.sortOrder), asc(images.id))
    .all();
}

export function getTagsFor(paintingId: number) {
  return db
    .select({ name: tags.name, slug: tags.slug })
    .from(tags)
    .innerJoin(paintingTags, eq(paintingTags.tagId, tags.id))
    .where(eq(paintingTags.paintingId, paintingId))
    .orderBy(asc(tags.name))
    .all();
}

/** Prev/next follow the gallery's own ordering, not insertion order. */
export function neighbours(sortOrder: number, id: number) {
  const [prev] = db
    .select({ publicId: paintings.publicId, title: paintings.title })
    .from(paintings)
    .where(
      and(
        eq(paintings.status, "published"),
        sql`(${paintings.sortOrder}, ${paintings.id}) < (${sortOrder}, ${id})`,
      ),
    )
    .orderBy(desc(paintings.sortOrder), desc(paintings.id))
    .limit(1)
    .all();

  const [next] = db
    .select({ publicId: paintings.publicId, title: paintings.title })
    .from(paintings)
    .where(
      and(
        eq(paintings.status, "published"),
        sql`(${paintings.sortOrder}, ${paintings.id}) > (${sortOrder}, ${id})`,
      ),
    )
    .orderBy(asc(paintings.sortOrder), asc(paintings.id))
    .limit(1)
    .all();

  return { prev: prev ?? null, next: next ?? null };
}

export function getPage(slug: string) {
  const [row] = db.select().from(pages).where(eq(pages.slug, slug)).limit(1).all();
  return row ?? null;
}

export { formatSize } from "./format";
