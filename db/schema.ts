import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * PLAN.md §5. Timestamps are unix seconds.
 *
 * Two deliberate departures from the plan's sketch, both noted there:
 *  - `publicId` replaces a stored `slug`. The URL is `<publicId>-<hebrew title>`,
 *    but only the id identifies the painting, so the cosmetic Hebrew tail is
 *    derived at render time and can never go stale when a title changes.
 *  - dimensions are stored as two numbers rather than one display string,
 *    because that is what the import manifest supplies and it keeps them sortable.
 */

export const paintings = sqliteTable(
  "paintings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),

    /** 6-char base36, assigned once, never changes. The URL identity. */
    publicId: text("public_id").notNull(),

    title: text("title").notNull(),
    year: integer("year"),
    medium: text("medium"),
    widthCm: real("width_cm"),
    heightCm: real("height_cm"),

    /** Hebrew, from the corrected transcript. Markdown. */
    story: text("story"),

    /** Unused in v1 — present so adding English is never a migration. */
    titleEn: text("title_en"),
    storyEn: text("story_en"),

    status: text("status", { enum: ["draft", "published", "hidden"] })
      .notNull()
      .default("draft"),

    /** Private admin bookkeeping. Never rendered publicly, never in an anon API response. */
    provenance: text("provenance", {
      enum: ["artist", "sold", "gifted", "unknown"],
    })
      .notNull()
      .default("unknown"),
    provenanceNote: text("provenance_note"),

    /** Her recorded telling, archived. Not published in v1. */
    audioPath: text("audio_path"),

    /** Set by the bulk importer, cleared by /admin/import-review. */
    needsCrop: integer("needs_crop", { mode: "boolean" }).notNull().default(false),
    needsReview: integer("needs_review", { mode: "boolean" }).notNull().default(false),

    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by", { enum: ["admin", "artist", "import"] })
      .notNull()
      .default("admin"),

    createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("paintings_public_id_idx").on(t.publicId),
    // The public gallery query: published only, ordered.
    index("paintings_status_sort_idx").on(t.status, t.sortOrder),
    index("paintings_review_idx").on(t.needsReview),
  ],
);

export const images = sqliteTable(
  "images",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),

    /**
     * Null while an upload is in flight: the background upload starts the moment
     * she confirms the crop, before she has finished typing and before the
     * painting row exists. Attached on save. Orphans older than a day are swept.
     */
    paintingId: integer("painting_id").references(() => paintings.id, {
      onDelete: "cascade",
    }),

    /** Content-hashed path under /data/images/originals. Never modified after it lands. */
    originalPath: text("original_path").notNull(),
    originalHash: text("original_hash").notNull(),

    /**
     * Crop rectangle in original-pixel coordinates, applied server-side when
     * derivatives are built. Null for web uploads, which arrive already cropped.
     * Imported photos keep their uncropped original, so re-cropping stays possible.
     */
    cropJson: text("crop_json"),

    /**
     * Hash of the cropped pixels — distinct from originalHash, and what the
     * public derivative URLs are keyed on. Null until processing completes.
     */
    derivedHash: text("derived_hash"),

    /** Intrinsic size of the *derived* (cropped) image, for layout and srcset. */
    width: integer("width"),
    height: integer("height"),
    /** ~30-byte blur placeholder, base64. Drives the blur-up. */
    thumbhash: text("thumbhash"),
    exifJson: text("exif_json"),

    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),

    processingStatus: text("processing_status", {
      enum: ["pending", "processing", "done", "failed"],
    })
      .notNull()
      .default("pending"),
    processingError: text("processing_error"),

    createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
  },
  (t) => [
    index("images_painting_idx").on(t.paintingId, t.sortOrder),
    index("images_processing_idx").on(t.processingStatus),
  ],
);

export const tags = sqliteTable(
  "tags",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
  },
  (t) => [uniqueIndex("tags_slug_idx").on(t.slug)],
);

export const paintingTags = sqliteTable(
  "painting_tags",
  {
    paintingId: integer("painting_id")
      .notNull()
      .references(() => paintings.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.paintingId, t.tagId] }),
    index("painting_tags_tag_idx").on(t.tagId),
  ],
);

/** Editable prose pages — currently just 'about'. */
export const pages = sqliteTable("pages", {
  slug: text("slug").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
});

export type Painting = typeof paintings.$inferSelect;
export type NewPainting = typeof paintings.$inferInsert;
export type Image = typeof images.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Page = typeof pages.$inferSelect;
