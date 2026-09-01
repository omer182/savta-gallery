import { eq } from "drizzle-orm";
import { db, images } from "@/db";
import { type CropRect, generateDerivatives } from "./images";

/**
 * Derivative generation runs after the upload responds, so she never watches a
 * progress bar while sharp works (PLAN.md §3). Upload volume is one painting at
 * a time, so an in-process serial queue is the right size — no Redis, no worker.
 *
 * Serial rather than parallel on purpose: sharp is CPU-heavy and the home server
 * also runs Plex and the *arr stack. Saturating it would be rude.
 */

type Job = { imageId: number; crop?: CropRect | null };

const pending: Job[] = [];
let running = false;

export function enqueue(job: Job) {
  pending.push(job);
  void drain();
}

async function drain() {
  if (running) return;
  running = true;
  try {
    while (pending.length) {
      const job = pending.shift()!;
      await run(job).catch((err) => {
        // A failed image must never take the process down; it is recorded and
        // surfaced in the admin editor instead.
        console.error("[queue] image", job.imageId, "failed:", err);
      });
    }
  } finally {
    running = false;
  }
}

async function run({ imageId, crop }: Job) {
  const [img] = db.select().from(images).where(eq(images.id, imageId)).limit(1).all();
  if (!img) return;

  db.update(images).set({ processingStatus: "processing" }).where(eq(images.id, imageId)).run();

  try {
    const rect = crop ?? (img.cropJson ? (JSON.parse(img.cropJson) as CropRect) : null);
    const out = await generateDerivatives(img.originalPath, rect);

    db.update(images)
      .set({
        derivedHash: out.derivedHash,
        width: out.width,
        height: out.height,
        thumbhash: out.thumbhash,
        processingStatus: "done",
        processingError: null,
      })
      .where(eq(images.id, imageId))
      .run();
  } catch (err) {
    db.update(images)
      .set({
        processingStatus: "failed",
        processingError: err instanceof Error ? err.message : String(err),
      })
      .where(eq(images.id, imageId))
      .run();
    throw err;
  }
}

/** Await completion — used by the import CLI, which is not request-scoped. */
export async function processNow(imageId: number, crop?: CropRect | null) {
  await run({ imageId, crop });
}
