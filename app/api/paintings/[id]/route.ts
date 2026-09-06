import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db, paintings } from "@/db";
import { getSession } from "@/lib/auth";
import { revalidateAll } from "@/lib/revalidate";
import {
  deletePainting,
  type PaintingInput,
  setStatus,
  updatePainting,
} from "@/lib/mutations";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number((await ctx.params).id);
  const body = (await req.json().catch(() => null)) as
    | (PaintingInput & { status?: "draft" | "published" | "hidden" })
    | null;
  if (!body) return Response.json({ error: "Bad request" }, { status: 400 });

  const [current] = db
    .select({ status: paintings.status })
    .from(paintings)
    .where(eq(paintings.id, id))
    .limit(1)
    .all();
  if (!current) return Response.json({ error: "Not found" }, { status: 404 });

  // The editor saves fields and state together, so it always sends `status`.
  // Only an actual CHANGE is a publish action — rejecting an unchanged value
  // would block a non-admin from saving ordinary edits.
  const changingStatus = !!body.status && body.status !== current.status;
  if (changingStatus && session.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (body.title) updatePainting(id, body);
  if (changingStatus) setStatus(id, body.status!);

  revalidateAll();
  return Response.json({ ok: true, status: body.status ?? current.status });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  // Deletion is admin-only — the artist role has no destructive action anywhere (§1).
  if (session?.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  deletePainting(Number((await ctx.params).id));
  return Response.json({ ok: true });
}
