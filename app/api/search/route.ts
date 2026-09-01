import type { NextRequest } from "next/server";
import { toCardView } from "@/lib/cardView";
import { searchPublished } from "@/lib/search";

/** Backs the live results on /search. Published paintings only. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) return Response.json({ items: [] });

  return Response.json(
    { items: searchPublished(q).map(toCardView) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
