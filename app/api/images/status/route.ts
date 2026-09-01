import { inArray } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db, images } from "@/db";
import { getSession } from "@/lib/auth";

/** Polled while derivatives are generated in the background (PLAN.md §3, §6). */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const ids = (req.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!ids.length) return Response.json({ items: [] });

  const rows = db
    .select({
      id: images.id,
      status: images.processingStatus,
      error: images.processingError,
      derivedHash: images.derivedHash,
    })
    .from(images)
    .where(inArray(images.id, ids))
    .all();

  return Response.json({ items: rows }, { headers: { "Cache-Control": "no-store" } });
}
