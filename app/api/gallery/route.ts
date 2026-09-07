import type { NextRequest } from "next/server";
import { toCardView } from "@/lib/cardView";
import { listPublished } from "@/lib/queries";

/**
 * Backs the endless scroll on the gallery. Published paintings only, in the
 * same order and page size as the server-rendered first page, so a page
 * fetched here is exactly the page /?page=n would have rendered.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const tag = sp.get("tag") ?? undefined;

  const { items, hasMore } = listPublished({ tag, page });

  return Response.json(
    { items: items.map(toCardView), hasMore },
    { headers: { "Cache-Control": "no-store" } },
  );
}
