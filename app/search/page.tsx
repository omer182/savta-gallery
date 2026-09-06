import g from "@/components/gallery.module.css";
import { PublicShell } from "@/components/PublicShell";
import { SearchClient } from "./SearchClient";

export const metadata = { title: "חיפוש" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  return (
    <PublicShell current="search">
      <div className={g.wrap}>
        <SearchClient initialQuery={q ?? ""} />
      </div>
    </PublicShell>
  );
}
