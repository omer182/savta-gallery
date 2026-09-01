import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, pages } from "@/db";
import { getSession } from "@/lib/auth";

export async function PUT(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (session?.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const slug = (await ctx.params).slug;
  const body = (await req.json().catch(() => null)) as { title?: string; body?: string } | null;
  if (!body) return Response.json({ error: "Bad request" }, { status: 400 });

  const now = Math.floor(Date.now() / 1000);
  const existing = db.select().from(pages).where(eq(pages.slug, slug)).get();

  if (existing) {
    db.update(pages)
      .set({ title: body.title ?? existing.title, body: body.body ?? "", updatedAt: now })
      .where(eq(pages.slug, slug))
      .run();
  } else {
    db.insert(pages)
      .values({ slug, title: body.title ?? slug, body: body.body ?? "", updatedAt: now })
      .run();
  }

  revalidatePath(`/${slug}`);
  return Response.json({ ok: true });
}
