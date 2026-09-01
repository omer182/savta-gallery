import type { NextRequest } from "next/server";
import { db, images } from "@/db";
import { getSession } from "@/lib/auth";
import { storeOriginal } from "@/lib/images";
import { enqueue } from "@/lib/queue";

/**
 * Upload endpoint — PLAN.md §6.
 *
 * MUST be a Route Handler, never a Server Action: Server Actions cap the request
 * body at 1MB by default and would reject every real photograph. Route handlers
 * stream and have no such limit.
 *
 * The client has already converted HEIC→JPEG, applied the crop and downscaled to
 * 3000px, so what arrives here is a few MB at most (§4).
 */

export const maxDuration = 60;

const MAX_BYTES = 50 * 1024 * 1024; // matches nginx client_max_body_size

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "לא התקבלה תמונה." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "התמונה גדולה מדי." }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());

  let stored;
  try {
    stored = await storeOriginal(buf);
  } catch {
    return Response.json({ error: "לא הצלחנו לקרוא את התמונה." }, { status: 400 });
  }

  // Usually absent: the upload starts at crop-confirm, before she has finished
  // typing, so the image is an orphan until save attaches it.
  const raw = Number(form?.get("paintingId"));
  const paintingId = Number.isFinite(raw) && raw > 0 ? raw : null;
  const isPrimary = form?.get("isPrimary") !== "false";

  const [row] = db
    .insert(images)
    .values({
      paintingId,
      originalPath: stored.relPath,
      originalHash: stored.hash,
      exifJson: stored.exif ? JSON.stringify(stored.exif) : null,
      isPrimary,
      processingStatus: "pending",
    })
    .returning({ id: images.id })
    .all();

  // Returns immediately; derivatives are built in the background and polled, so
  // she never watches sharp work (§3).
  enqueue({ imageId: row!.id });

  return Response.json({ imageId: row!.id, width: stored.width, height: stored.height });
}
