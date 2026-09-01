import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db, paintings } from "@/db";
import { getSession } from "@/lib/auth";
import { revalidateAll } from "@/lib/mutations";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session?.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const b = (await req.json().catch(() => null)) as
    | {
        id: number;
        title: string;
        year: number | null;
        medium: string | null;
        widthCm: number | null;
        heightCm: number | null;
        story: string | null;
        done: boolean;
      }
    | null;
  if (!b?.id) return Response.json({ error: "Bad request" }, { status: 400 });

  db.update(paintings)
    .set({
      title: b.title?.trim() || "ללא שם",
      year: b.year,
      medium: b.medium,
      widthCm: b.widthCm,
      heightCm: b.heightCm,
      story: b.story,
      // Deferred entries stay pending; the client carries them in ?skip= so the
      // queue advances without losing them.
      needsReview: !b.done,
      updatedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(paintings.id, b.id))
    .run();

  revalidateAll();
  return Response.json({ ok: true });
}
