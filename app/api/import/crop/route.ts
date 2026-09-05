import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db, images, paintings } from "@/db";
import { getSession } from "@/lib/auth";
import { pixelRectFromPercent } from "@/lib/images";
import { revalidateAll } from "@/lib/mutations";
import { processNow } from "@/lib/queue";

type PctRect = { x: number; y: number; width: number; height: number };

/**
 * Approves crops and only then triggers derivative generation (PLAN.md §11) —
 * imported originals still contain wall and sticky note, so this is the gate.
 *
 * Rects arrive as PERCENTAGES and are converted here against the original's
 * real, rotation-corrected dimensions. The client never has to know how large
 * the photo actually is, so a browser laying the image out at some other size
 * cannot produce a wrong crop.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session?.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    items?: Array<{ imageId: number; paintingId: number; rectPct: PctRect | null }>;
  } | null;
  if (!body?.items?.length) return Response.json({ error: "Bad request" }, { status: 400 });

  const failures: number[] = [];

  for (const item of body.items) {
    const [img] = db
      .select({ id: images.id, originalPath: images.originalPath })
      .from(images)
      .where(eq(images.id, item.imageId))
      .limit(1)
      .all();
    if (!img) {
      failures.push(item.imageId);
      continue;
    }

    const rect = item.rectPct
      ? await pixelRectFromPercent(img.originalPath, item.rectPct)
      : null;

    db.update(images)
      .set({ cropJson: rect ? JSON.stringify(rect) : null })
      .where(eq(images.id, item.imageId))
      .run();

    try {
      await processNow(item.imageId, rect);
    } catch {
      failures.push(item.imageId);
    }

    db.update(paintings)
      .set({ needsCrop: false })
      .where(eq(paintings.id, item.paintingId))
      .run();
  }

  // Extra frames — signature, the back, a texture close-up — are not the
  // painting, so the canvas rectangle must NOT be applied to them. They still
  // need derivatives or they would render as "processing" forever, so they are
  // processed uncropped once their painting has been approved.
  for (const item of body.items) {
    const siblings = db
      .select({ id: images.id })
      .from(images)
      .where(and(eq(images.paintingId, item.paintingId), eq(images.processingStatus, "pending")))
      .all();

    for (const sib of siblings) {
      if (sib.id === item.imageId) continue;
      try {
        await processNow(sib.id, null);
      } catch {
        failures.push(sib.id);
      }
    }
  }

  revalidateAll();
  return Response.json({ ok: true, failures });
}
