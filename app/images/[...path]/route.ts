import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { IMAGES_DIR } from "@/lib/paths";

/**
 * Serves image derivatives in development and as the origin fallback.
 *
 * In production nginx serves /images/ straight off disk and this handler is
 * never reached (PLAN.md §7) — but it must exist and behave identically, so a
 * misconfigured vhost degrades to "slower" rather than "broken".
 */

const TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await ctx.params;

  // Path traversal guard: resolve, then require the result to stay inside
  // IMAGES_DIR. Rejecting ".." by string match alone is not sufficient.
  const abs = path.resolve(IMAGES_DIR, ...segments);
  const root = path.resolve(IMAGES_DIR);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    return new Response("Not found", { status: 404 });
  }

  // Only derivatives are public. Originals are the uncropped frames — for
  // imported paintings they still contain the wall and the numbered sticky
  // note — and are served solely to the crop pass.
  if (segments[0] !== "derived") {
    const session = await getSession();
    if (session?.role !== "admin") return new Response("Not found", { status: 404 });
  }

  const type = TYPES[path.extname(abs).toLowerCase()];
  if (!type) return new Response("Not found", { status: 404 });

  let stat;
  try {
    stat = await fs.stat(abs);
    if (!stat.isFile()) throw new Error("not a file");
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const stream = createReadStream(abs) as unknown as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(stat.size),
      // Derivative filenames are content-hashed, so the bytes behind a URL
      // never change. Originals are admin-only and must not be cached publicly.
      "Cache-Control":
        segments[0] === "derived"
          ? "public, max-age=31536000, immutable"
          : "private, no-store",
    },
  });
}
