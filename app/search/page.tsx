import g from "@/components/gallery.module.css";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { SearchClient } from "./SearchClient";

export const metadata = { title: "חיפוש" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  return (
    <>
      <SiteHeader current="search" />
      <main className={g.wrap}>
        <SearchClient initialQuery={q ?? ""} />
      </main>
      <SiteFooter />
    </>
  );
}
