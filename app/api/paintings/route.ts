import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { createPainting, type PaintingInput, revalidateAll, setStatus } from "@/lib/mutations";

/** Creates a painting. Both roles may create; both create drafts (PLAN.md §1). */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | (PaintingInput & { tags?: string[]; publishNow?: boolean })
    | null;
  if (!body?.title?.trim()) {
    return Response.json({ error: "צריך שם לציור." }, { status: 400 });
  }

  // Free-text tag creation is admin-only (§1); the artist may only pick from
  // existing tags, which the client enforces and this ignores rather than trusts.
  const painting = createPainting(body, session.role);

  // Admin may publish in one step rather than saving a draft and going back for
  // it. The artist cannot, whatever the client sends.
  const published = body.publishNow === true && session.role === "admin";
  if (published) setStatus(painting.id, "published");

  revalidateAll();
  return Response.json({ id: painting.id, publicId: painting.publicId, published });
}
