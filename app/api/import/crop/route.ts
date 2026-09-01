import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db, images, paintings } from "@/db";
import { getSession } from "@/lib/auth";
import type { CropRect } from "@/lib/images";
import { revalidateAll } from "@/lib/mutations";
import { processNow } from "@/lib/queue";

/**
 * Approves a crop and only then triggers derivative generation (PLAN.md §11) —
 * imported originals still contain wall and sticky note, so this is the gate.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session?.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    items?: Array<{ imageId: number; paintingId: number; rect: CropRect | null }>;
  } | null;
  if (!body?.items?.length) return Response.json({ error: "Bad request" }, { status: 400 });

  const failures: number[] = [];

  for (const item of body.items) {
    db.update(images)
      .set({ cropJson: item.rect ? JSON.stringify(item.rect) : null })
      .where(eq(images.id, item.imageId))
      .run();

    try {
      await processNow(item.imageId, item.rect);
    } catch {
      failures.push(item.imageId);
    }

    db.update(paintings)
      .set({ needsCrop: false })
      .where(eq(paintings.id, item.paintingId))
      .run();
  }

  revalidateAll();
  return Response.json({ ok: true, failures });
}
