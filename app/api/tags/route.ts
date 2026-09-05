import { asc } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db, tags } from "@/db";
import { getSession } from "@/lib/auth";
import { upsertTags } from "@/lib/mutations";

export async function GET() {
  const rows = db.select({ name: tags.name }).from(tags).orderBy(asc(tags.name)).all();
  return Response.json({ tags: rows.map((t) => t.name) });
}

/**
 * Creates a tag immediately rather than waiting for the painting to be saved,
 * so it is available to the next painting (and the next session) even if this
 * one is abandoned. Admin only — the artist picks from what exists (PLAN.md §1).
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session?.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { name?: string } | null;
  const name = body?.name?.trim();
  if (!name) return Response.json({ error: "צריך שם לתגית." }, { status: 400 });

  upsertTags([name]);
  const rows = db.select({ name: tags.name }).from(tags).orderBy(asc(tags.name)).all();
  return Response.json({ name, tags: rows.map((t) => t.name) });
}
