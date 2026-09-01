import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db, paintings } from "@/db";
import { getSession } from "@/lib/auth";
import { DATA_DIR } from "@/lib/paths";

/**
 * Serves an archived recording to the story pass. Admin-only and never public:
 * the audio is a family record, and v1 publishes the text, not her voice
 * (PLAN.md §5, §10).
 */
const TYPES: Record<string, string> = {
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
};

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (session?.role !== "admin") return new Response("Not found", { status: 404 });

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isFinite(id)) return new Response("Not found", { status: 404 });

  const [row] = db
    .select({ audioPath: paintings.audioPath })
    .from(paintings)
    .where(eq(paintings.id, id))
    .limit(1)
    .all();
  if (!row?.audioPath) return new Response("Not found", { status: 404 });

  // The stored path comes from the import manifest, so treat it as untrusted:
  // resolve and confirm it stays inside DATA_DIR.
  const abs = path.resolve(DATA_DIR, row.audioPath);
  const root = path.resolve(DATA_DIR);
  if (!abs.startsWith(root + path.sep)) return new Response("Not found", { status: 404 });

  const type = TYPES[path.extname(abs).toLowerCase()];
  if (!type) return new Response("Not found", { status: 404 });

  let stat;
  try {
    stat = await fs.stat(abs);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  return new Response(createReadStream(abs) as unknown as ReadableStream, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(stat.size),
      "Cache-Control": "private, no-store",
    },
  });
}
