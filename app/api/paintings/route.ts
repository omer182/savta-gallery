import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { createPainting, type PaintingInput, revalidateAll } from "@/lib/mutations";

/** Creates a painting. Both roles may create; both create drafts (PLAN.md §1). */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as (PaintingInput & { tags?: string[] }) | null;
  if (!body?.title?.trim()) {
    return Response.json({ error: "צריך שם לציור." }, { status: 400 });
  }

  // Free-text tag creation is admin-only (§1); the artist may only pick from
  // existing tags, which the client enforces and this ignores rather than trusts.
  const painting = createPainting(body, session.role);
  revalidateAll();

  return Response.json({ id: painting.id, publicId: painting.publicId });
}
