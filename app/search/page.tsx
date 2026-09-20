import { redirect } from "next/navigation";

/**
 * Search lives on the gallery now, as a field above the tag strip.
 *
 * This route stays only so links to /search?q= that are already out in the
 * world keep working. It forwards rather than rendering a second search UI -
 * two implementations of the same field is how they drift apart.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const term = q?.trim();
  redirect(term ? `/?search=1&q=${encodeURIComponent(term)}` : "/?search=1");
}
