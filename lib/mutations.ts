import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, images, paintings, paintingTags, tags } from "@/db";
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

function attachImages(paintingId: number, imageIds: number[]) {
  if (!imageIds.length) return;
  db.update(images)
    .set({ paintingId })
    .where(and(inArray(images.id, imageIds), isNull(images.paintingId)))
    .run();

  // Exactly one primary (§5). First attached wins unless one is already set.
  const rows = db.select().from(images).where(eq(images.paintingId, paintingId)).all();
  if (!rows.some((r) => r.isPrimary) && rows[0]) {
    db.update(images).set({ isPrimary: true }).where(eq(images.id, rows[0].id)).run();
  }
}

export function setStatus(id: number, status: "draft" | "published" | "hidden") {
  db.update(paintings)
    .set({ status, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(paintings.id, id))
    .run();
  revalidateAll();
}

export function deletePainting(id: number) {
  db.delete(paintings).where(eq(paintings.id, id)).run();
  revalidateAll();
}

/** Publishing must invalidate the cached public pages (§9). */
export function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/about");
  revalidatePath("/painting/[slug]", "page");
}

/**
 * Uploads that were never saved leave orphan image rows. Swept on admin load
 * rather than by a cron, since this is the only place that notices.
 */
export function sweepOrphanImages(olderThanHours = 24) {
  const cutoff = Math.floor(Date.now() / 1000) - olderThanHours * 3600;
  return db
    .delete(images)
    .where(and(isNull(images.paintingId), lt(images.createdAt, cutoff)))
    .run();
}
