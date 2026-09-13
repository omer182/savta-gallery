import { and, eq, isNotNull, isNull, lt, ne, notInArray, sql } from "drizzle-orm";
import { db, images, pages, paintings, paintingTags, tags } from "@/db";
import { newPublicId, slugifyTitle } from "./slug";

export type PaintingInput = {
  title: string;
  year?: number | null;
  medium?: string | null;
  widthCm?: number | null;
  heightCm?: number | null;
  story?: string | null;
  tags?: string[];
  imageIds?: number[];
  provenance?: "artist" | "sold" | "gifted" | "unknown";
};

/** Tags are shared; create on first use, reuse by slug thereafter. */
export function upsertTags(names: string[]): number[] {
  const ids: number[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const slug = slugifyTitle(name);
    if (!slug) continue;

    const [existing] = db.select({ id: tags.id }).from(tags).where(eq(tags.slug, slug)).all();
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    const [created] = db.insert(tags).values({ name, slug }).returning({ id: tags.id }).all();
    ids.push(created!.id);
  }
  return ids;
}

export function createPainting(input: PaintingInput, createdBy: "admin" | "artist" | "import") {
  // New work sorts to the front; the gallery orders by sortOrder ascending.
  const [{ min }] = db
    .select({ min: sql<number>`coalesce(min(${paintings.sortOrder}), 0)` })
    .from(paintings)
    .all();

  const [row] = db
    .insert(paintings)
    .values({
      publicId: newPublicId(),
      title: input.title.trim(),
      year: input.year ?? null,
      medium: input.medium?.trim() || null,
      widthCm: input.widthCm ?? null,
      heightCm: input.heightCm ?? null,
      story: input.story?.trim() || null,
      provenance: input.provenance ?? "unknown",
      status: "draft",
      sortOrder: (min ?? 0) - 1,
      createdBy,
    })
    .returning()
    .all();

  applyTags(row!.id, input.tags ?? []);
  attachImages(row!.id, input.imageIds ?? []);
  return row!;
}

export function updatePainting(id: number, input: PaintingInput) {
  db.update(paintings)
    .set({
      title: input.title.trim(),
      year: input.year ?? null,
      medium: input.medium?.trim() || null,
      widthCm: input.widthCm ?? null,
      heightCm: input.heightCm ?? null,
      story: input.story?.trim() || null,
      ...(input.provenance ? { provenance: input.provenance } : {}),
      updatedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(paintings.id, id))
    .run();

  if (input.tags) applyTags(id, input.tags);
  if (input.imageIds?.length) attachImages(id, input.imageIds);
  return db.select().from(paintings).where(eq(paintings.id, id)).get();
}

function applyTags(paintingId: number, names: string[]) {
  const ids = upsertTags(names);
  db.delete(paintingTags).where(eq(paintingTags.paintingId, paintingId)).run();
  for (const tagId of new Set(ids)) {
    db.insert(paintingTags).values({ paintingId, tagId }).run();
  }
}

/**
 * Attaches THE photograph. One painting has exactly one image (PLAN.md §5).
 *
 * Enforced here and not merely in the UI, so nothing upstream can quietly grow
 * a second one: only the first id is taken, and attaching a new photograph
 * detaches whatever was there before. The old row is left orphaned rather than
 * deleted, so sweepOrphanImages collects it on the usual schedule and a
 * mistaken replacement is recoverable for a day.
 *
 * The isNull guard stays: an image already belonging to another painting can
 * never be stolen by passing its id.
 */
function attachImages(paintingId: number, imageIds: number[]) {
  const next = imageIds[0];
  if (next === undefined) return;

  const claimed = db
    .update(images)
    .set({ paintingId, isPrimary: true })
    .where(and(eq(images.id, next), isNull(images.paintingId)))
    .run();

  // Nothing claimed means the id was already spoken for; leave the existing
  // photograph alone rather than detaching it for a replacement that failed.
  if (claimed.changes === 0) return;

  db.update(images)
    .set({ paintingId: null, isPrimary: false })
    .where(and(eq(images.paintingId, paintingId), ne(images.id, next)))
    .run();
}

export function setStatus(id: number, status: "draft" | "published" | "hidden") {
  db.update(paintings)
    .set({ status, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(paintings.id, id))
    .run();
}

export function deletePainting(id: number) {
  db.delete(paintings).where(eq(paintings.id, id)).run();
}

/**
 * Uploads that were never saved leave orphan image rows. Swept on admin load
 * rather than by a cron, since this is the only place that notices.
 *
 * A page portrait is deliberately an image with no painting, so it looks
 * exactly like an abandoned upload — without the notInArray guard the sweep
 * would delete her portrait a day after it was added.
 */
export function sweepOrphanImages(olderThanHours = 24) {
  const cutoff = Math.floor(Date.now() / 1000) - olderThanHours * 3600;

  const referenced = db
    .select({ id: pages.portraitImageId })
    .from(pages)
    .where(isNotNull(pages.portraitImageId))
    .all()
    .map((r) => r.id)
    .filter((id): id is number => id !== null);

  const orphaned = and(isNull(images.paintingId), lt(images.createdAt, cutoff));

  return db
    .delete(images)
    .where(referenced.length ? and(orphaned, notInArray(images.id, referenced)) : orphaned)
    .run();
}
