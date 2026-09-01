import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import {
  deletePainting,
  type PaintingInput,
  revalidateAll,
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

  if (body.status) {
    // Publishing is admin-only; "hide" is the artist-safe alternative to delete,
    // but she has no reason to reach this route at all (§1).
    if (session.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    setStatus(id, body.status);
  }

  if (body.title) {
    updatePainting(id, body);
    revalidateAll();
  }

  return Response.json({ ok: true });
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
